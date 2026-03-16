pub mod stage1_validator;
pub mod stage2_extractor;
pub mod stage3_indexer;
pub mod stage4_flattener;
pub mod stage5_matcher;
pub mod stage6_parser;
pub mod stage7_exif_writer;
pub mod stage8_output;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc::Sender;
use tracing::{info, error, warn};

use crate::types::{JobConfig, ProgressEvent, RunSummary};

/// Main orchestration logic for the pipeline.
pub fn run_pipeline(
    config: JobConfig,
    progress_tx: Sender<ProgressEvent>,
    cancel_flag: Arc<AtomicBool>,
) -> anyhow::Result<RunSummary> {
    let mut summary = RunSummary {
        output_path: config.output_path.clone(),
        ..Default::default()
    };
    
    let start_time = std::time::Instant::now();

    // Stage 1: Validate
    emit_progress(&progress_tx, 1, "Input Validation", 0, 1, None);
    let val_result = stage1_validator::validate_input(&config.input_paths)?;
    if val_result.has_errors {
        return Err(anyhow::anyhow!("Validation failed with errors"));
    }
    
    // Stage 2: Extract
    let workspace = stage2_extractor::create_workspace()?;
    emit_progress(&progress_tx, 2, "Archive Extraction", 0, 100, None);
    
    let paths_str: Vec<String> = val_result.archives.iter().map(|a| a.path.clone()).collect();
    stage2_extractor::extract_archives(&paths_str, &workspace, |curr, total| {
        emit_progress(&progress_tx, 2, "Archive Extraction", curr, total, None);
    })?;

    if cancel_flag.load(Ordering::Relaxed) {
        stage2_extractor::cleanup_workspace(&workspace);
        return Err(anyhow::anyhow!("Job cancelled by user"));
    }

    // Stage 3: Indexing
    emit_progress(&progress_tx, 3, "File Discovery & Indexing", 0, 1, None);
    let index_res = stage3_indexer::index_files(&workspace);
    info!("Found {} images, {} videos, {} json", index_res.images.len(), index_res.videos.len(), index_res.json_sidecars.len());

    // Stage 4: Flattening
    emit_progress(&progress_tx, 4, "Workspace Flattening", 0, index_res.images.len() as u64, None);
    let flatten_res = stage4_flattener::flatten_workspace(
        index_res.images, 
        index_res.videos, 
        index_res.raw_files
    );
    summary.duplicates_removed = flatten_res.duplicate_count;
    let working_set = flatten_res.working_set;

    // Stage 5: Matching
    emit_progress(&progress_tx, 5, "Metadata Matching", 0, working_set.len() as u64, None);
    let mut match_res = stage5_matcher::match_metadata(working_set, index_res.json_sidecars);
    summary.unmatched_sidecars = match_res.orphaned_sidecars.len() as u64;

    // Stage 6: Parse & Resolve
    let matched_len = match_res.matched_files.len() as u64;
    emit_progress(&progress_tx, 6, "Metadata Parsing", 0, matched_len, None);
    for (i, media) in match_res.matched_files.iter_mut().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) { break; }
        if let Err(e) = stage6_parser::parse_and_resolve(media) {
            error!("Parser error for {}: {}", media.source_path.display(), e);
            summary.errors += 1;
        }
        if i % 100 == 0 {
            emit_progress(&progress_tx, 6, "Metadata Parsing", i as u64, matched_len, None);
        }
    }

    // Stage 8 pre-calc: Output Paths
    emit_progress(&progress_tx, 7, "Output Configuration", 0, match_res.matched_files.len() as u64, None);
    let raw_output_path = config.output_path.trim().to_string();
    let output_dir = normalize_path(PathBuf::from(&raw_output_path));
    
    if !config.dry_run {
        if let Err(e) = std::fs::create_dir_all(&output_dir) {
            error!("Could not create output directory {}: {}", output_dir.display(), e);
            return Err(anyhow::anyhow!("Failed to create output directory: {}", e));
        }
    } else {
        info!("PREVIEW MODE: Scanning library without writing to {}", output_dir.display());
    }

    let output_routes = stage8_output::calculate_output_paths(
        &match_res.matched_files,
        &output_dir,
        &config.output_mode,
    );

    // Stage 7 + 8 Write Phase: Embed EXIF & Write Output
    let stage_name = if config.dry_run { "Scan & Preview" } else { "EXIF Embedding & Writing" };
    emit_progress(&progress_tx, 8, stage_name, 0, output_routes.len() as u64, None);
    
    for (i, (media_idx, dest_path)) in output_routes.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) { break; }
        
        let normalized_dest = normalize_path(dest_path.clone());
        let media = &match_res.matched_files[*media_idx];

        if !config.dry_run {
            // Ensure destination dir exists
            if let Some(p) = normalized_dest.parent() {
                // We retry a few times for directory creation on Windows
                let mut ok = false;
                for _ in 0..3 {
                    if let Ok(_) = std::fs::create_dir_all(p) {
                        ok = true;
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                if !ok {
                    warn!("Could not create directory {} for file {}", p.display(), normalized_dest.display());
                }
            }

            match stage7_exif_writer::embed_metadata(media, &normalized_dest) {
                Ok(_) => summary.processed_ok += 1,
                Err(e) => {
                    error!("Write error for {}: {}", normalized_dest.display(), e);
                    summary.errors += 1;
                }
            }
        } else {
            // Scan & Preview: Just simulate
            summary.processed_ok += 1;
            if i % 1000 == 0 {
                info!("[SCAN] Would write: {}", normalized_dest.display());
            }
        }

        if matches!(media.resolved_metadata.as_ref().map(|m| &m.timestamp_source), Some(crate::types::TimestampSource::Undated)) {
            summary.undated_files += 1;
        }

        if i % 10 == 0 {
            emit_progress(&progress_tx, 8, stage_name, (i+1) as u64, output_routes.len() as u64, Some(media.source_path.file_name().unwrap().to_string_lossy().to_string()));
        }
    }

    summary.total_input_files = summary.processed_ok + summary.skipped + summary.errors + summary.duplicates_removed;
    summary.elapsed_seconds = start_time.elapsed().as_secs_f64();
    summary.dry_run = config.dry_run;

    // Report
    let log_path = output_dir.join("processing-report.log");
    summary.log_path = log_path.to_string_lossy().to_string();
    stage8_output::write_report(&log_path, &summary, &match_res.orphaned_sidecars)?;

    // Cleanup
    if !cancel_flag.load(Ordering::Relaxed) {
        stage2_extractor::cleanup_workspace(&workspace);
    }

    Ok(summary)
}

fn emit_progress(tx: &Sender<ProgressEvent>, stage: u8, name: &str, curr: u64, total: u64, msg: Option<String>) {
    let _ = tx.blocking_send(ProgressEvent {
        stage,
        stage_name: name.to_string(),
        current: curr,
        total,
        processed: curr,
        skipped: 0,
        errors: 0,
        current_file: msg.clone(),
        message: msg,
    });
}

/// Robust path normalization for Windows (Long Path support) and Unix.
fn normalize_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let path_str = path.to_string_lossy();
        // If it's already a verbatim path or relative, leave it
        if path_str.starts_with(r"\\?\") || !path.is_absolute() {
            return path;
        }

        // Prepend the Win32 verbatim prefix to bypass MAX_PATH (260 char) limit
        // and ensure we use backslashes.
        let s = path_str.replace("/", "\\");
        
        // Handle drive letters like C:\
        if s.len() >= 2 && s.chars().nth(0).unwrap().is_alphabetic() && s.chars().nth(1) == Some(':') {
             return PathBuf::from(format!(r"\\?\{}", s));
        }
    }
    path
}
