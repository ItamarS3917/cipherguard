use tauri::{AppHandle, Manager};
use std::fs;

#[tauri::command]
pub fn read_storage(key: String, app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    if !file_path.exists() {
        return Ok(String::from("null"));
    }

    fs::read_to_string(file_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_storage(key: String, value: String, app: AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    fs::write(file_path, value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_storage(key: String, app: AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
