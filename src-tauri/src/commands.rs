use tauri::{AppHandle, Window, Emitter, window::ProgressBarState, window::ProgressBarStatus};
use tokio::sync::mpsc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use crate::pipeline::stage1_validator;
use crate::types::{JobConfig, ValidationResult, RunSummary, ProgressEvent};

// Global cancel flag
lazy_static::lazy_static! {
    static ref CANCEL_FLAG: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

#[tauri::command]
pub async fn validate_input(paths: Vec<String>) -> Result<ValidationResult, String> {
    stage1_validator::validate_input(&paths).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_processing(config: JobConfig, window: Window, app: AppHandle) -> Result<RunSummary, String> {
    CANCEL_FLAG.store(false, Ordering::Relaxed);
    
    let (tx, mut rx) = mpsc::channel::<ProgressEvent>(100);
    
    // Spawn task to forward progress to frontend
    // Spawn task to forward progress to frontend and update taskbar
    let window_clone = window.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Taskbar progress (0-100 scale in Tauri v2 needs to be normalized or used as state)
            let percent = if event.total > 0 {
                (event.current as f64 / event.total as f64 * 100.0) as u64
            } else {
                0
            };
            
            let _ = window_clone.set_progress_bar(ProgressBarState {
                progress: Some(percent),
                status: Some(ProgressBarStatus::Normal),
            });

            let _ = window_clone.emit("progress", event);
        }
        
        // Reset progress bar on finish
        let _ = window_clone.set_progress_bar(ProgressBarState {
            progress: None,
            status: Some(ProgressBarStatus::None),
        });
    });

    let flag = Arc::clone(&CANCEL_FLAG);
    
    // Run pipeline in blocking task so we don't block Tauri event loop
    let result = tokio::task::spawn_blocking(move || {
        crate::pipeline::run_pipeline(config, tx, flag)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Save to history
    let _ = crate::history::save_to_history(&app, &result);

    Ok(result)
}

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Result<Vec<RunSummary>, String> {
    crate::history::load_history(&app)
}

#[tauri::command]
pub async fn clear_history(app: AppHandle) -> Result<(), String> {
    crate::history::clear_history(&app)
}

#[tauri::command]
pub async fn cancel_processing() -> Result<(), String> {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn open_output_folder(path: String, _app: AppHandle) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())?;
    Ok(())
}
