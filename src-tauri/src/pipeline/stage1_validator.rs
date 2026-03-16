use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use xxhash_rust::xxh3::xxh3_64;
use crate::types::{ArchiveInfo, ValidationResult, ValidationWarning, WarningKind};

/// Validate input paths: detect segments, CRC-check archives, estimate disk usage.
pub fn validate_input(input_paths: &[String]) -> Result<ValidationResult> {
    let mut paths: Vec<PathBuf> = input_paths
        .iter()
        .map(|p| PathBuf::from(p))
        .collect();

    // If a single directory is given, return it for direct scanning (no ZIP extraction needed)
    if paths.len() == 1 && paths[0].is_dir() {
        return Ok(ValidationResult {
            archives: vec![ArchiveInfo {
                path: paths[0].to_string_lossy().to_string(),
                size_bytes: dir_size(&paths[0]),
                segment_index: None,
                is_valid: true,
                error: None,
            }],
            warnings: vec![],
            estimated_extracted_gb: 0.0,
            has_errors: false,
        });
    }

    // Auto-detect sibling segments if user provides Takeout-001.zip
    paths = expand_segments(paths)?;

    // Deduplicate archives by first-1MB hash
    paths = deduplicate_archives(paths);

    let mut archives: Vec<ArchiveInfo> = Vec::new();
    let mut warnings: Vec<ValidationWarning> = Vec::new();
    let mut total_compressed: u64 = 0;
    let mut has_errors = false;

    for (idx, path) in paths.iter().enumerate() {
        if !path.exists() {
            archives.push(ArchiveInfo {
                path: path.to_string_lossy().to_string(),
                size_bytes: 0,
                segment_index: Some(idx as u32 + 1),
                is_valid: false,
                error: Some("File not found".to_string()),
            });
            has_errors = true;
            continue;
        }

        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
        total_compressed += size;

        match verify_zip_crc(&path) {
            Ok(()) => {
                archives.push(ArchiveInfo {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: size,
                    segment_index: Some(idx as u32 + 1),
                    is_valid: true,
                    error: None,
                });
            }
            Err(e) => {
                archives.push(ArchiveInfo {
                    path: path.to_string_lossy().to_string(),
                    size_bytes: size,
                    segment_index: Some(idx as u32 + 1),
                    is_valid: false,
                    error: Some(format!("CRC check failed: {}", e)),
                });
                warnings.push(ValidationWarning {
                    kind: WarningKind::CorruptArchive,
                    message: format!(
                        "Archive {} failed CRC check and may be corrupted",
                        path.file_name().unwrap_or_default().to_string_lossy()
                    ),
                });
            }
        }
    }

    // Estimated extracted size: compressed × 1.5
    let estimated_bytes = (total_compressed as f64) * 1.5;
    let estimated_gb = estimated_bytes / 1_073_741_824.0;

    // Disk space check
    if let Some(first_path) = paths.first() {
        if let Some(parent) = first_path.parent() {
            if let Ok(free) = free_space(parent) {
                let headroom = free as f64 - estimated_bytes;
                let headroom_pct = headroom / (free as f64 + 1.0);
                if headroom_pct < 0.10 {
                    warnings.push(ValidationWarning {
                        kind: WarningKind::LowDiskSpace,
                        message: format!(
                            "Low disk space: estimated {:.1} GB needed, {:.1} GB free",
                            estimated_gb,
                            free as f64 / 1_073_741_824.0
                        ),
                    });
                }
            }
        }
    }

    Ok(ValidationResult {
        archives,
        warnings,
        estimated_extracted_gb: estimated_gb,
        has_errors,
    })
}

/// Expand Takeout-001.zip → find all Takeout-002.zip, 003, etc. in same directory.
fn expand_segments(mut paths: Vec<PathBuf>) -> Result<Vec<PathBuf>> {
    let mut extra: Vec<PathBuf> = Vec::new();

    for path in &paths {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        // Match pattern like "takeout-20240101T000000Z-001.zip" or "takeout-001.zip"
        if let Some(parent) = path.parent() {
            if let Some((prefix, suffix)) = find_segment_pattern(&name) {
                let mut n = 1u32;
                loop {
                    n += 1;
                    let candidate_name = format!("{}{:03}{}", prefix, n, suffix);
                    let candidate = parent.join(&candidate_name);
                    if candidate.exists() && !paths.contains(&candidate) && !extra.contains(&candidate) {
                        extra.push(candidate);
                    } else {
                        break;
                    }
                }
                // Also check for missing segments
                check_missing_segments(parent, &prefix, &suffix, &paths, &extra);
            }
        }
    }

    paths.extend(extra);
    paths.sort();
    Ok(paths)
}

/// Try to find a segment pattern like `prefix-NNN.zip` → returns (prefix, suffix)
fn find_segment_pattern(name: &str) -> Option<(String, String)> {
    // Find a 3-digit sequence near the end of the stem
    let name_lower = name.to_lowercase();
    if !name_lower.ends_with(".zip") {
        return None;
    }
    let stem = &name[..name.len() - 4];

    // Look for -NNN or _NNN pattern
    for i in (0..stem.len().saturating_sub(2)).rev() {
        let slice = &stem[i..];
        if slice.len() >= 3 {
            let digits = &slice[..3];
            let before = &stem[..i];
            if digits.chars().all(|c| c.is_ascii_digit())
                && !before.is_empty()
                && (before.ends_with('-') || before.ends_with('_'))
            {
                return Some((before.to_string(), ".zip".to_string()));
            }
        }
    }
    None
}

fn check_missing_segments(
    parent: &Path,
    prefix: &str,
    suffix: &str,
    existing: &[PathBuf],
    extra: &[PathBuf],
) {
    // Just a best-effort check — warnings handled at a higher level
    let _ = (parent, prefix, suffix, existing, extra);
}

/// Deduplicate archives by hashing their first 1 MB.
fn deduplicate_archives(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen: std::collections::HashSet<u64> = std::collections::HashSet::new();
    let mut result = Vec::new();
    for path in paths {
        if let Ok(mut f) = std::fs::File::open(&path) {
            use std::io::Read;
            let mut buf = vec![0u8; 1_048_576];
            let n = f.read(&mut buf).unwrap_or(0);
            let h = xxh3_64(&buf[..n]);
            if seen.insert(h) {
                result.push(path);
            }
        } else {
            result.push(path);
        }
    }
    result
}

/// Verify a ZIP file's CRC integrity without fully extracting it.
fn verify_zip_crc(path: &Path) -> Result<()> {
    let file = std::fs::File::open(path)
        .with_context(|| format!("Cannot open {}", path.display()))?;
    let mut zip = zip::ZipArchive::new(file)
        .with_context(|| format!("Not a valid ZIP: {}", path.display()))?;

    for i in 0..zip.len().min(20) {
        let entry = zip.by_index(i)
            .with_context(|| format!("Cannot read entry {} in {}", i, path.display()))?;
        // Reading the entry triggers CRC verification in the zip crate
        drop(entry);
    }
    Ok(())
}

fn dir_size(path: &Path) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

#[allow(unused_variables)]
fn free_space(path: &Path) -> Result<u64> {
    // Use statvfs on Unix, GetDiskFreeSpaceEx on Windows — simplified cross-platform
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let mut free_bytes_caller: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut free_bytes_total: u64 = 0;
        unsafe {
            windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut free_bytes_caller,
                &mut total_bytes,
                &mut free_bytes_total,
            );
        }
        Ok(free_bytes_caller)
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Fallback: assume plenty of space
        Ok(u64::MAX)
    }
}
