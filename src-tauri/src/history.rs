use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use crate::types::RunSummary;

pub fn get_history_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    path.push("history.json");
    Ok(path)
}

pub fn save_to_history(app: &AppHandle, summary: &RunSummary) -> Result<(), String> {
    let path = get_history_file_path(app)?;
    let mut history = load_history(app).unwrap_or_else(|_| Vec::new());
    
    // Add new summary to the beginning
    history.insert(0, summary.clone());
    
    // Keep only last 50 runs
    if history.len() > 50 {
        history.truncate(50);
    }
    
    let json = serde_json::to_string_pretty(&history).map_err(|e| e.to_string())?;
    
    // Atomic Write: Write to .tmp then rename
    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, json).map_err(|e| e.to_string())?;
    
    // On some platforms rename can fail if target exists, but fs::rename handles this on most modern OS
    fs::rename(tmp_path, path).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn load_history(app: &AppHandle) -> Result<Vec<RunSummary>, String> {
    let path = get_history_file_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    
    // Handle potential corruption or empty files
    let history: Vec<RunSummary> = serde_json::from_str(&json).map_err(|e| {
        // If file is corrupt, backup the broken one and return empty so user can still use the app
        let corrupt_path = path.with_extension("corrupt");
        let _ = fs::rename(&path, corrupt_path);
        format!("History file was corrupted and has been reset. {}", e)
    })?;
    
    Ok(history)
}

pub fn clear_history(app: &AppHandle) -> Result<(), String> {
    let path = get_history_file_path(app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
