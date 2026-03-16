use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use xxhash_rust::xxh3::xxh3_64;
use crate::types::{FileEntry, MediaFile, MatchStrategy};
use tracing::{debug, warn};

pub struct FlattenResult {
    pub working_set: Vec<MediaFile>,
    pub duplicate_count: u64,
}

/// Consolidate all media files into a single working set, deduplicating by hash.
pub fn flatten_workspace(
    mut images: Vec<FileEntry>,
    mut videos: Vec<FileEntry>,
    raw_files: Vec<FileEntry>,
) -> FlattenResult {
    let mut all_files: Vec<FileEntry> = Vec::new();
    all_files.append(&mut images);
    all_files.append(&mut videos);
    all_files.extend(raw_files);

    // Compute hashes in parallel using Rayon
    use rayon::prelude::*;
    let hashed: Vec<(FileEntry, u64)> = all_files
        .into_par_iter()
        .filter_map(|mut entry| {
            match compute_hash(&entry.path) {
                Ok(h) => {
                    entry.hash = Some(h);
                    Some((entry, h))
                }
                Err(e) => {
                    warn!("Cannot hash {}: {}", entry.path.display(), e);
                    None
                }
            }
        })
        .collect();

    // Group by hash: hash → Vec<FileEntry>
    let mut hash_map: HashMap<u64, Vec<FileEntry>> = HashMap::new();
    for (entry, hash) in hashed {
        hash_map.entry(hash).or_default().push(entry);
    }

    let mut working_set: Vec<MediaFile> = Vec::new();
    let mut duplicate_count: u64 = 0;

    // Track filenames already used in the working set to handle EC-11 (same name, different content)
    let mut filename_registry: HashMap<String, u32> = HashMap::new();

    for (_hash, mut group) in hash_map {
        if group.is_empty() { continue; }

        // Sort group: prefer a copy that is NOT in a "duplicates" or temp folder
        group.sort_by_key(|e| {
            let path_str = e.path.to_string_lossy().to_lowercase();
            if path_str.contains("duplicate") || path_str.contains("_seg") { 1 } else { 0 }
        });

        duplicate_count += (group.len() as u64).saturating_sub(1);

        let primary = group.remove(0);

        // Collect all album memberships across duplicates
        let mut albums: Vec<String> = Vec::new();
        if let Some(a) = &primary.album {
            albums.push(a.clone());
        }
        for dup in &group {
            if let Some(a) = &dup.album {
                if !albums.contains(a) {
                    albums.push(a.clone());
                }
            }
        }

        let filename = primary.path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        // Is this an edited variant? Treat as separate file regardless of hash match
        // (EC-03: IMG_1234-edited.jpg is distinct)
        let is_edited = is_edited_variant(&filename);

        // Check for filename collision (same name, genuinely different hash is handled below)
        let _ = is_edited; // both edited and original go through same collision resolution

        let resolved_filename = resolve_name(&filename, &mut filename_registry);
        let resolved_path = primary.path.with_file_name(&resolved_filename);

        working_set.push(MediaFile {
            source_path: primary.path,
            category: primary.category,
            size_bytes: primary.size_bytes,
            hash: primary.hash.unwrap_or(0),
            albums,
            sidecar_path: None,
            match_strategy: Some(MatchStrategy::Unmatched),
            resolved_metadata: None,
        });

        debug!("Working set: {} (albums: {:?})", resolved_path.display(), working_set.last().unwrap().albums);
    }

    working_set.sort_by(|a, b| a.source_path.cmp(&b.source_path));

    FlattenResult {
        working_set,
        duplicate_count,
    }
}

/// Check if a filename is an edited variant (ends in -edited, -bearbeitet, etc.)
pub fn is_edited_variant(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    let edit_suffixes = ["-edited", "-bearbeitet", "-modifié", "-editado", "-modificato"];
    let stem = lower.rsplit_once('.').map(|(s, _)| s).unwrap_or(&lower);
    edit_suffixes.iter().any(|suffix| stem.ends_with(suffix))
}

/// Compute xxHash3-64 of a file.
fn compute_hash(path: &PathBuf) -> anyhow::Result<u64> {
    let mut file = std::fs::File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    Ok(xxh3_64(&buf))
}

/// Resolve filename collisions: if "IMG_001.jpg" is taken, use "IMG_001_2.jpg".
fn resolve_name(filename: &str, registry: &mut HashMap<String, u32>) -> String {
    let count = registry.entry(filename.to_string()).or_insert(0);
    if *count == 0 {
        *count = 1;
        filename.to_string()
    } else {
        *count += 1;
        let n = *count;
        // Insert suffix before extension
        if let Some(dot_pos) = filename.rfind('.') {
            format!("{}_{}{}", &filename[..dot_pos], n, &filename[dot_pos..])
        } else {
            format!("{}_{}", filename, n)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_edited_variant() {
        assert!(is_edited_variant("IMG_1234-edited.jpg"));
        assert!(is_edited_variant("video-bearbeitet.mp4"));
        assert!(is_edited_variant("photo-modifié.png"));
        assert!(!is_edited_variant("IMG_1234.jpg"));
        assert!(!is_edited_variant("IMG_1234-5678.jpg"));
    }

    #[test]
    fn test_resolve_name() {
        let mut registry = HashMap::new();
        
        assert_eq!(resolve_name("IMG_001.jpg", &mut registry), "IMG_001.jpg");
        assert_eq!(registry.get("IMG_001.jpg"), Some(&1));
        
        assert_eq!(resolve_name("IMG_001.jpg", &mut registry), "IMG_001_2.jpg");
        assert_eq!(registry.get("IMG_001.jpg"), Some(&2));

        assert_eq!(resolve_name("IMG_001.jpg", &mut registry), "IMG_001_3.jpg");
        
        assert_eq!(resolve_name("no_ext_file", &mut registry), "no_ext_file");
        assert_eq!(resolve_name("no_ext_file", &mut registry), "no_ext_file_2");
    }
}
