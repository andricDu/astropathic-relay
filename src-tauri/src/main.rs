// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::process::{Command, Child};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::collections::HashMap;
use dirs;
use tauri::State;

// Define the structure for port forwards
#[derive(Serialize, Deserialize, Clone)]
struct ListenPortForward {
    remote: String,
    #[serde(rename = "remotePort")]
    remote_port: String,
}

struct ProcessState(Mutex<Option<Child>>);

// Simple command to test functionality
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn run_sshuttle(
    state: State<'_, ProcessState>, 
    host: String, 
    subnets: String, 
    dns: bool,
    port_forwards: Vec<ListenPortForward>
) -> Result<String, String> {
    // Build the sshuttle command string using String values consistently
    let mut sshuttle_args = vec!["-r".to_string(), host.clone(), subnets.clone()];
    
    if dns {
        sshuttle_args.push("--dns".to_string());
    }
    
    // Add port forwarding arguments
    for pf in &port_forwards {
        sshuttle_args.push("-l".to_string());
        let port_str = format!("{}:{}", pf.remote, pf.remote_port);
        sshuttle_args.push(port_str); // Now this works because everything is String
    }
    
    sshuttle_args.push("-v".to_string());
    
    // Join all arguments into a single string for osascript
    let args_str = sshuttle_args.join(" ");
    
    // Use osascript to show a graphical sudo prompt
    #[cfg(target_os = "macos")]
    {
        // Create AppleScript that runs sudo with sshuttle
        let script = format!(
            "do shell script \"sshuttle {}\" with administrator privileges", 
            args_str
        );
        
        // Run the AppleScript - FIX: Convert io::Error to String
        let output = Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| e.to_string())?;  // Add map_err to convert the error
            
        // Store process in state for later termination
        let mut state_guard = state.0.lock().unwrap();
        *state_guard = Some(output);
        
        return Ok("Connection established with elevated privileges".into());
    }
    
    // Linux-specific implementation using pkexec
    #[cfg(target_os = "linux")]
    {
        // Check if pkexec is available
        if Command::new("which").arg("pkexec").output().is_ok() {
            // Create command using pkexec
            let mut command = Command::new("pkexec");
            command.arg("sshuttle")
                   .args(sshuttle_args);
                   
            // Linux-specific implementation
            match command.spawn() {
                Ok(child) => {
                    let mut state_guard = state.0.lock().unwrap();
                    *state_guard = Some(child);
                    Ok("Connection established with elevated privileges".into())
                },
                Err(e) => Err(format!("Failed to start sshuttle: {}", e))
            }
        } else {
            Err("pkexec not found. Please install policykit-1".into())
        }
    }
    
    // Windows implementations would go here
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        Err("Elevated privileges required. This feature is currently only supported on macOS and Linux.".into())
    }
}

#[tauri::command]
fn stop_sshuttle(state: State<'_, ProcessState>) -> Result<String, String> {
    let mut state_guard = state.0.lock().unwrap();
    
    if let Some(mut child) = state_guard.take() {
        // Attempt to kill the process
        match child.kill() {
            Ok(_) => {
                // Try to wait for the process to exit
                match child.wait() {
                    Ok(_) => {
                        // Try to kill any remaining sshuttle processes 
                        // (needed if running with sudo)
                        let _ = Command::new("pkill")
                            .args(["-f", "sshuttle"])
                            .status();
                        
                        Ok("Connection terminated successfully".into())
                    },
                    Err(e) => Err(format!("Error waiting for process to exit: {}", e))
                }
            },
            Err(e) => {
                // If direct kill failed, try pkill
                let kill_result = Command::new("pkill")
                    .args(["-f", "sshuttle"])
                    .status();
                
                if kill_result.is_ok() {
                    Ok("Connection forcefully terminated".into())
                } else {
                    Err(format!("Failed to kill sshuttle process: {}", e))
                }
            }
        }
    } else {
        Ok("No active connection to terminate".into())
    }
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
    
    if !config_path.exists() {
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

fn main() {
    tauri::Builder::default()
        .manage(ProcessState(Mutex::new(None)))  // Add this line
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            run_sshuttle, 
            stop_sshuttle, 
            load_connections, 
            save_connection, 
            delete_connection
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}
