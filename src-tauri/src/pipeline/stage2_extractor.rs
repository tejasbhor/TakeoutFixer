use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use std::io::{Read, Write};
use tracing::{info, warn};

/// Extract all archives into a unified temporary workspace.
pub fn extract_archives(
    archive_paths: &[String],
    workspace_dir: &Path,
    progress_cb: impl Fn(u64, u64) + Send + Sync,
) -> Result<()> {
    let mut total_entries: u64 = 0;
    let mut processed: u64 = 0;

    // First pass: count total entries
    for archive_path in archive_paths {
        let path = PathBuf::from(archive_path);
        if path.is_dir() {
            // Pre-extracted directory — just use it directly (copy not needed, workspace = input)
            return Ok(());
        }
        if let Ok(f) = std::fs::File::open(&path) {
            if let Ok(zip) = zip::ZipArchive::new(f) {
                total_entries += zip.len() as u64;
            }
        }
    }

    for (seg_idx, archive_path) in archive_paths.iter().enumerate() {
        let path = PathBuf::from(archive_path);
        if path.is_dir() {
            continue;
        }

        let file = std::fs::File::open(&path)
            .with_context(|| format!("Cannot open archive: {}", path.display()))?;
        let mut zip = zip::ZipArchive::new(file)
            .with_context(|| format!("Invalid ZIP: {}", path.display()))?;

        for i in 0..zip.len() {
            let mut entry = match zip.by_index(i) {
                Ok(e) => e,
                Err(e) => {
                    warn!("Skipping ZIP entry {}: {}", i, e);
                    processed += 1;
                    continue;
                }
            };

            let entry_name = entry.name().to_string();

            // Security: skip path traversal entries
            if entry_name.contains("..") || entry_name.starts_with('/') || entry_name.starts_with('\\') {
                warn!("Skipping path traversal entry: {}", entry_name);
                processed += 1;
                continue;
            }

            // Skip directory entries
            if entry.is_dir() {
                processed += 1;
                continue;
            }

            let mut dest_path = workspace_dir.join(&entry_name);

            // Handle cross-segment filename collisions
            if dest_path.exists() {
                let size_on_disk = dest_path.metadata().map(|m| m.len()).unwrap_or(0);
                if size_on_disk == entry.size() {
                    // Same file already extracted — skip (incremental resume)
                    processed += 1;
                    progress_cb(processed, total_entries);
                    continue;
                }
                // Different content: save with segment suffix
                if let Some(stem) = dest_path.file_stem() {
                    let ext = dest_path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
                    let new_name = format!("{}_seg{}{}", stem.to_string_lossy(), seg_idx + 1, ext);
                    dest_path = dest_path.with_file_name(new_name);
                }
            }

            // Create parent directories
            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("Cannot create dir: {}", parent.display()))?;
            }

            // Stream-copy entry to destination
            let mut out_file = std::fs::File::create(&dest_path)
                .with_context(|| format!("Cannot create: {}", dest_path.display()))?;

            let mut buf = vec![0u8; 65_536];
            loop {
                let n = entry.read(&mut buf)?;
                if n == 0 { break; }
                out_file.write_all(&buf[..n])?;
            }

            processed += 1;
            progress_cb(processed, total_entries);
        }

        info!("Extracted segment {}: {}", seg_idx + 1, path.display());
    }

    Ok(())
}

/// Create a temporary workspace directory in the system temp folder.
pub fn create_workspace() -> Result<PathBuf> {
    let base = std::env::temp_dir().join("takeoutfixer_workspace");
    std::fs::create_dir_all(&base)
        .with_context(|| format!("Cannot create workspace: {}", base.display()))?;
    Ok(base)
}

/// Clean up the temporary workspace after processing.
pub fn cleanup_workspace(workspace: &Path) {
    if let Err(e) = std::fs::remove_dir_all(workspace) {
        warn!(
            "Could not clean up workspace {}: {}. Please delete it manually.",
            workspace.display(),
            e
        );
    }
}
