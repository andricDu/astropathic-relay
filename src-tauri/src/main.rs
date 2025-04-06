// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::process::Command;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::collections::HashMap;
use dirs;

// Define the structure for port forwards
#[derive(Serialize, Deserialize, Clone)]
struct ListenPortForward {
    remote: String,
    #[serde(rename = "remotePort")]
    remote_port: String,
}

struct ProcessState(Mutex<Option<std::process::Child>>);

// Simple command to test functionality
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Command to run sshuttle
#[tauri::command]
async fn run_sshuttle(
    host: String, 
    subnets: String, 
    dns: bool,
    port_forwards: Vec<ListenPortForward>
) -> Result<String, String> {

    let mut command = Command::new("sshuttle");
    command.arg("-r").arg(host).arg(subnets);
    
    if dns {
        command.arg("--dns");
    }
    
    // Add port forwarding arguments
    for pf in port_forwards {
        command.arg("-l")
               .arg(format!("{}:{}",pf.remote, pf.remote_port));
    }

    command.arg("-v");

    // Use askpass to prompt for password graphically
    std::env::set_var("SUDO_ASKPASS", "/usr/bin/ssh-askpass");
    command.env("SUDO_ASKPASS", "/usr/bin/ssh-askpass");
    
    match command.spawn() {
        Ok(_) => Ok("Connection established successfully".into()),
        Err(e) => Err(format!("Failed to start sshuttle: {}", e))
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

// Update main function to register the new commands
fn main() {
    tauri::Builder::default()
        .manage(ProcessState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            run_sshuttle, 
            load_connections, 
            save_connection, 
            delete_connection
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}
