fn main() {
    // This build script intentionally doesn't do anything special.
    // It's just here to satisfy Tauri's project structure requirements.
    println!("cargo:rerun-if-changed=build.rs");
}
