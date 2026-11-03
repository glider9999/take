// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn get_vault_key(provider: &str) -> Result<String, String> {
    let entry = keyring::Entry::new("im.take.client", provider)
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(k) => Ok(k),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_vault_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("im.take.client", provider)
        .map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_vault_key, set_vault_key])
        .run(tauri::generate_context!())
        .expect("error while running take desktop application");
}

