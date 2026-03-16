use std::path::Path;
use walkdir::WalkDir;
use crate::types::{FileCategory, FileEntry};
use tracing::{debug, warn};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "heic", "heif", "tiff", "tif", "gif", "bmp", "webp"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "avi", "mkv", "m4v", "3gp", "wmv", "flv"];
const RAW_EXTENSIONS: &[&str] = &["arw", "cr2", "cr3", "nef", "nrw", "orf", "raf", "rw2", "dng", "pef", "srw"];
const IGNORED_EXTENSIONS: &[&str] = &["html", "htm", "csv", "pdf", "ds_store", "thumbs.db", "db"];
const IGNORED_FILENAMES: &[&str] = &[".ds_store", "thumbs.db", "desktop.ini", ".gitkeep"];

pub struct IndexResult {
    pub images: Vec<FileEntry>,
    pub videos: Vec<FileEntry>,
    pub json_sidecars: Vec<FileEntry>,
    pub raw_files: Vec<FileEntry>,
    pub ignored_count: u64,
    pub zero_byte_count: u64,
    pub unsorted: Vec<FileEntry>,
}

/// Recursively scan workspace, classify every file into categories.
pub fn index_files(workspace: &Path) -> IndexResult {
    let mut result = IndexResult {
        images: Vec::new(),
        videos: Vec::new(),
        json_sidecars: Vec::new(),
        raw_files: Vec::new(),
        ignored_count: 0,
        zero_byte_count: 0,
        unsorted: Vec::new(),
    };

    for entry in WalkDir::new(workspace).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path().to_path_buf();
        if !path.is_file() {
            continue;
        }

        let meta = match path.metadata() {
            Ok(m) => m,
            Err(e) => {
                warn!("Cannot read metadata for {}: {}", path.display(), e);
                continue;
            }
        };

        // Skip zero-byte files (EC-09)
        if meta.len() == 0 {
            warn!("Skipping zero-byte file: {}", path.display());
            result.zero_byte_count += 1;
            continue;
        }

        let file_entry = FileEntry {
            path: path.clone(),
            category: FileCategory::Ignored,
            size_bytes: meta.len(),
            hash: None,
            album: extract_album_name(workspace, &path),
        };

        let ext = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let filename_lower = path.file_name()
            .and_then(|f| f.to_str())
            .map(|f| f.to_lowercase())
            .unwrap_or_default();

        // Ignored filenames
        if IGNORED_FILENAMES.iter().any(|&n| filename_lower == n) {
            result.ignored_count += 1;
            debug!("Ignoring: {}", path.display());
            continue;
        }

        if ext == "json" {
            result.json_sidecars.push(FileEntry {
                category: FileCategory::JsonSidecar,
                ..file_entry
            });
        } else if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            result.images.push(FileEntry {
                category: FileCategory::Image,
                ..file_entry
            });
        } else if VIDEO_EXTENSIONS.contains(&ext.as_str()) {
            result.videos.push(FileEntry {
                category: FileCategory::Video,
                ..file_entry
            });
        } else if RAW_EXTENSIONS.contains(&ext.as_str()) {
            result.raw_files.push(FileEntry {
                category: FileCategory::RawImage,
                ..file_entry
            });
        } else if IGNORED_EXTENSIONS.contains(&ext.as_str()) {
            result.ignored_count += 1;
        } else {
            result.unsorted.push(FileEntry {
                category: FileCategory::Unsorted,
                ..file_entry
            });
        }
    }

    result
}

/// Extract album name from the path relative to workspace.
/// Google Takeout structure: workspace/Google Photos/Album Name/photo.jpg
fn extract_album_name(workspace: &Path, file_path: &Path) -> Option<String> {
    let rel = file_path.strip_prefix(workspace).ok()?;
    let components: Vec<_> = rel.components().collect();

    // Album is typically 2nd component (index 1) if there are at least 2 parent dirs
    if components.len() >= 3 {
        let album = components[components.len() - 2]
            .as_os_str()
            .to_string_lossy()
            .to_string();
        if !album.is_empty() && album != "Google Photos" {
            return Some(album);
        }
    }
    None
}
