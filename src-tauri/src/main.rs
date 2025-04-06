// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Mutex, Arc};
use std::process::{Command, Child};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write, BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use dirs;
use tauri::{State, Emitter};
use std::thread;
use tauri::Manager;

// Define the structure for port forwards
#[derive(Serialize, Deserialize, Clone)]
struct ListenPortForward {
    remote: String,
    #[serde(rename = "remotePort")]
    remote_port: String,
}

struct ProcessState(Mutex<Option<FakeChild>>);

// Create a shared buffer for output
struct OutputBuffer(Mutex<Vec<String>>);

// Simple command to test functionality
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Update the run_sshuttle function
#[tauri::command(allowed_capabilities = ["event:default", "shell:default", "process:default"])]
#[cfg(target_os = "macos")]
fn run_sshuttle(
    app_handle: tauri::AppHandle,
    state: State<'_, ProcessState>, 
    host: String, 
    subnets: String, 
    dns: bool,
    port_forwards: Vec<ListenPortForward>
) -> Result<String, String> {
    // Create output file path
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let output_file = home.join(".sshuttle-output.log");
    let output_path = output_file.to_str().unwrap();
    
    // Build command args as before
    let mut sshuttle_args = vec!["-r".to_string(), host.clone(), subnets.clone()];
    
    if dns {
        sshuttle_args.push("--dns".to_string());
    }
    
    // Add port forwarding arguments
    for pf in &port_forwards {
        sshuttle_args.push("-l".to_string());
        let port_str = format!("{}:{}", pf.remote, pf.remote_port);
        sshuttle_args.push(port_str);
    }
    
    sshuttle_args.push("-v".to_string());
    let args_str = sshuttle_args.join(" ");
    
    // Create AppleScript that redirects to file
    let script = format!(
        "do shell script \"sshuttle {} > '{}' 2>&1 & echo $!\" with administrator privileges", 
        args_str, output_path
    );
    
    // Execute AppleScript to start sshuttle
    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())?;
    
    // Extract PID from output
    let pid = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    // Store fake child process with PID (for termination later)
    let mut state_guard = state.0.lock().unwrap();
    *state_guard = Some(FakeChild { pid });
    
    // Start background thread to read from log file
    let app_handle_clone = app_handle.clone();
    let output_file_clone = output_file.clone();
    thread::spawn(move || {
        // Wait briefly for file to be created
        thread::sleep(Duration::from_millis(500));
        
        let mut file = match File::open(&output_file_clone) {
            Ok(f) => f,
            Err(_) => return,
        };
        
        // Keep track of what we've read
        let mut position = 0;
        
        loop {
            // Sleep between reads
            thread::sleep(Duration::from_millis(200));
            
            // Get file metadata
            let metadata = match file.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            
            // Check if file has grown
            let len = metadata.len();
            if len > position {
                // Seek to where we left off
                file.seek(SeekFrom::Start(position)).ok();
                
                // Read new content
                let mut buffer = Vec::new();
                let bytes_read = match file.read_to_end(&mut buffer) {
                    Ok(n) => n,
                    Err(_) => continue,
                };
                
                // Update position
                position += bytes_read as u64;
                
                // Process new content
                let content = String::from_utf8_lossy(&buffer);
                for line in content.lines() {
                    // Add to buffer (for polling)
                    match app_handle_clone.try_state::<OutputBuffer>() {
                        Some(buffer) => {
                            let mut locked_buffer = buffer.0.lock().unwrap();
                            locked_buffer.push(line.to_string());
                        },
                        None => {},
                    }
                }
            }
        }
    });
    
    Ok("Connection established with elevated privileges".into())
}

// New struct for tracking PID
struct FakeChild {
    pid: String,
}

// Update stop_sshuttle to work with FakeChild
#[tauri::command]
fn stop_sshuttle(state: State<'_, ProcessState>) -> Result<String, String> {
    let mut state_guard = state.0.lock().unwrap();
    
    if let Some(fake_child) = state_guard.take() {
        // Run pkill using the stored PID
        let kill_result = Command::new("pkill")
            .args(["-P", &fake_child.pid])
            .status();
            
        if kill_result.is_ok() {
            // Also run pkill on any sshuttle processes
            let _ = Command::new("pkill")
                .args(["-f", "sshuttle"])
                .status();
            
            Ok("Connection terminated successfully".into())
        } else {
            Err("Failed to terminate connection".into())
        }
    } else {
        Ok("No active connection to terminate".into())
    }
}

#[tauri::command]
async fn check_sshuttle_running() -> Result<bool, String> {
    // Use more specific criteria to find only real sshuttle processes
    let output = Command::new("pgrep")
        .arg("-f")
        .arg("^sshuttle ")  // ^ ensures it starts with sshuttle
        .output()
        .map_err(|e| e.to_string())?;
    
    // Check if output actually contains PIDs
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    // Only return true for success with non-empty PID list
    // Exit code 0 means match found, exit code 1 means no match (expected when nothing is running)
    Ok(output.status.success() && !stdout.is_empty())
}

// Create a struct for saved connection profiles
#[derive(Serialize, Deserialize, Clone)]
struct ConnectionProfile {
    name: String,
    host: String,
    subnets: String,
    enable_dns: bool,
    port_forwards: Vec<ListenPortForward>,
}

// Get the path to the config file
fn get_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(".sshuttle-launcher.json"))
}

// Load saved connection profiles
#[tauri::command]
fn load_connections() -> Result<HashMap<String, ConnectionProfile>, String> {
    let config_path = get_config_path()?;
    
    if (!config_path.exists()) {
        return Ok(HashMap::new());
    }
    
    let mut file = File::open(config_path)
        .map_err(|e| format!("Failed to open config file: {}", e))?;
    
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let profiles: HashMap<String, ConnectionProfile> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;
    
    Ok(profiles)
}

// Save a new connection profile
#[tauri::command]
fn save_connection(
    name: String, 
    host: String, 
    subnets: String, 
    enable_dns: bool, 
    port_forwards: Vec<ListenPortForward>
) -> Result<(), String> {
    let mut profiles = load_connections()?;
    
    let profile = ConnectionProfile {
        name: name.clone(),
        host,
        subnets,
        enable_dns,
        port_forwards,
    };
    
    profiles.insert(name, profile);
    
    let config_path = get_config_path()?;
    let json = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    
    let mut file = File::create(config_path)
        .map_err(|e| format!("Failed to create config file: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    Ok(())
}

// Delete a saved connection profile
#[tauri::command]
fn delete_connection(name: String) -> Result<(), String> {
    let mut profiles = load_connections()?;
    
    profiles.remove(&name);
    
    let config_path = get_config_path()?;
    let json = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    
    let mut file = File::create(config_path)
        .map_err(|e| format!("Failed to create config file: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn get_sshuttle_output(state: State<'_, OutputBuffer>) -> Vec<String> {
    let mut buffer = state.0.lock().unwrap();
    let output = buffer.clone();
    buffer.clear();
    output
}

fn main() {
    tauri::Builder::default()
        .manage(ProcessState(Mutex::new(None)))
        .manage(OutputBuffer(Mutex::new(Vec::new())))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            run_sshuttle, 
            stop_sshuttle, 
            check_sshuttle_running,
            load_connections, 
            save_connection, 
            delete_connection,
            get_sshuttle_output
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}
