// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::process::Command;
use serde::Deserialize;

// Define the structure for port forwards
#[derive(Deserialize)]
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
    // Add the DNS flag to the command if enabled
    let dns_flag = if dns { "--dns" } else { "" };
    
    // Format port forward options for SSH
    let port_forward_args = port_forwards.iter()
        .map(|pf| format!("-l {}:{}", pf.remote, pf.remote_port))
        .collect::<Vec<String>>()
        .join(" ");
    
    // Using the standard Rust process API
    let cmd_str = format!("sshuttle -r {} {} {} {}", 
        host, 
        subnets, 
        dns_flag,
        port_forward_args
    );
    
    // For debugging - just show the command
    //Ok(format!("Execute: {}", cmd_str));
    

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

fn main() {
    tauri::Builder::default()
        .manage(ProcessState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet, run_sshuttle])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running tauri application");
}
