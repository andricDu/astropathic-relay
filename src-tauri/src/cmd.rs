// filepath: /sshuttle-launcher/sshuttle-launcher/src-tauri/src/cmd.rs
use std::process::Command;
use tauri::command;

#[command]
pub fn run_sshuttle(args: Vec<String>) -> Result<String, String> {
    let output = Command::new("sshuttle")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr.to_string())
    }
}