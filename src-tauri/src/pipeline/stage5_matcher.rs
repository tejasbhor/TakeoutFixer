use std::path::PathBuf;
use crate::types::{FileCategory, FileEntry, MatchStrategy, MediaFile};
use strsim::levenshtein;

pub struct MatchResult {
    pub matched_files: Vec<MediaFile>,
    pub orphaned_sidecars: Vec<PathBuf>,
}

/// Pair each image with its JSON sidecar using a multi-strategy waterfall.
pub fn match_metadata(
    mut working_set: Vec<MediaFile>,
    json_sidecars: Vec<FileEntry>,
) -> MatchResult {
    let mut available_jsons: Vec<PathBuf> = json_sidecars.into_iter().map(|f| f.path).collect();
    let mut orphaned_sidecars: Vec<PathBuf> = Vec::new();

    // Strategy 1: Exact match with extension (IMG_1234.jpg -> IMG_1234.jpg.json)
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let expected_json = format!("{}.json", media.source_path.file_name().unwrap().to_string_lossy());
        if let Some(idx) = available_jsons.iter().position(|p| p.file_name().unwrap() == expected_json.as_str()) {
            media.sidecar_path = Some(available_jsons.remove(idx));
            media.match_strategy = Some(MatchStrategy::ExactWithExtension);
        }
    }

    // Strategy 2: Exact match without extension (IMG_1234.jpg -> IMG_1234.json)
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        if let Some(stem) = media.source_path.file_stem() {
            let expected_json = format!("{}.json", stem.to_string_lossy());
            if let Some(idx) = available_jsons.iter().position(|p| p.file_name().unwrap() == expected_json.as_str()) {
                media.sidecar_path = Some(available_jsons.remove(idx));
                media.match_strategy = Some(MatchStrategy::ExactWithoutExtension);
            }
        }
    }

    // Strategy 3: Truncated names (Inverted check: JSON stem starts with Image Stem, or vice versa)
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let name_stem = media.source_path.file_stem().unwrap().to_string_lossy().to_lowercase();
        if name_stem.len() > 15 { // Only for reasonably long names to avoid false positives
            let idx = available_jsons.iter().position(|p| {
                let json_name = p.file_name().unwrap().to_string_lossy().to_lowercase();
                let json_stem = json_name.strip_suffix(".json").unwrap_or(&json_name).to_lowercase();
                json_stem.starts_with(&name_stem) || name_stem.starts_with(&json_stem)
            });
            if let Some(i) = idx {
                media.sidecar_path = Some(available_jsons.remove(i));
                media.match_strategy = Some(MatchStrategy::TruncatedPrefix);
            }
        }
    }

    // Strategy 4: Edited Variants (IMG_1234-edited.jpg -> IMG_1234.jpg.json)
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let name = media.source_path.file_name().unwrap().to_string_lossy();
        if name.contains("-edited") {
            let original_name = name.replace("-edited", "");
            let expected_json = format!("{}.json", original_name);
            if let Some(idx) = available_jsons.iter().position(|p| p.file_name().unwrap() == expected_json.as_str()) {
                media.sidecar_path = Some(available_jsons.remove(idx));
                media.match_strategy = Some(MatchStrategy::EditedVariant);
            }
        }
    }

    // Strategy 5: Counter reposition (IMG_1234(1).jpg -> IMG_1234.jpg(1).json)
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let name = media.source_path.file_name().unwrap().to_string_lossy();
        if let Some(expected_json) = generate_repositioned_counter_name(&name) {
            if let Some(idx) = available_jsons.iter().position(|p| p.file_name().unwrap() == expected_json.as_str()) {
                media.sidecar_path = Some(available_jsons.remove(idx));
                media.match_strategy = Some(MatchStrategy::CounterReposition);
            }
        }
    }

    // Strategy 6: Fuzzy Levenshtein (distance <= 2) on base name
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let name = media.source_path.file_name().unwrap().to_string_lossy();
        
        let mut best_match: Option<(usize, usize)> = None;
        
        for (i, json) in available_jsons.iter().enumerate() {
            let json_name = json.file_name().unwrap().to_string_lossy();
            let json_stem = json_name.strip_suffix(".json").unwrap_or(&json_name);
            let dist = levenshtein(&name, json_stem);
            
            if dist <= 2 {
                if best_match.is_none() || dist < best_match.unwrap().1 {
                    best_match = Some((i, dist));
                }
            }
        }
        
        if let Some((idx, _)) = best_match {
            media.sidecar_path = Some(available_jsons.remove(idx));
            media.match_strategy = Some(MatchStrategy::FuzzyLevenshtein);
        }
    }

    // Strategy 7: Component grouping (Live Photos / RAW+JPEG)
    // If a video or RAW has no sidecar, see if an image with the same stem already matched
    for i in 0..working_set.len() {
        if working_set[i].sidecar_path.is_some() { continue; }
        if working_set[i].category == FileCategory::Video || working_set[i].category == FileCategory::RawImage {
            let stem = working_set[i].source_path.file_stem().unwrap().to_string_lossy();
            
            // Try matching stem.json again specifically for videos
            let expected_json = format!("{}.json", stem);
            if let Some(idx) = available_jsons.iter().position(|p| p.file_name().unwrap() == expected_json.as_str()) {
                working_set[i].sidecar_path = Some(available_jsons.remove(idx));
                working_set[i].match_strategy = Some(MatchStrategy::LivePhotoComponent);
                continue;
            }

            // Fallback: borrow from a sibling image that already matched
            let sibling_idx = working_set.iter().position(|m| {
                m.source_path.file_stem().unwrap().to_string_lossy() == stem &&
                m.category == FileCategory::Image &&
                m.sidecar_path.is_some()
            });
            if let Some(s_idx) = sibling_idx {
                working_set[i].sidecar_path = working_set[s_idx].sidecar_path.clone();
                working_set[i].match_strategy = Some(MatchStrategy::LivePhotoComponent);
            }
        }
    }

    // Strategy 8: The "Ultimate Truth" - Scan JSON content for matching 'title' field
    // This is a catch-all for weirdly named files that the above logic missed.
    for media in &mut working_set {
        if media.sidecar_path.is_some() { continue; }
        let target_title = media.source_path.file_name().unwrap().to_string_lossy().to_lowercase();
        
        let mut best_json_idx: Option<usize> = None;
        for (idx, json_path) in available_jsons.iter().enumerate() {
            if let Ok(content) = std::fs::read_to_string(json_path) {
                // Quick look-ahead for the title field using a light regex to avoid full parsing overhead
                if let Some(start) = content.find("\"title\":") {
                    let end = content[start..].find(',').unwrap_or(content.len() - start);
                    let title_snippet = &content[start..start+end].to_lowercase();
                    if title_snippet.contains(&target_title) {
                        best_json_idx = Some(idx);
                        break;
                    }
                }
            }
        }

        if let Some(idx) = best_json_idx {
            media.sidecar_path = Some(available_jsons.remove(idx));
            media.match_strategy = Some(MatchStrategy::SidecarTitleMatch);
        }
    }

    // Remaining jsons are orphaned
    orphaned_sidecars.extend(available_jsons);

    MatchResult {
        matched_files: working_set,
        orphaned_sidecars,
    }
}

/// Helper for counter repositioning: IMG_1234(1).jpg -> IMG_1234.jpg(1).json
fn generate_repositioned_counter_name(filename: &str) -> Option<String> {
    // Regex would be cleaner, but simple string search is faster
    // Look for "(N)." before the extension
    if let Some(dot_pos) = filename.rfind('.') {
        let stem = &filename[..dot_pos];
        let ext = &filename[dot_pos..]; // e.g., ".jpg"
        
        if stem.ends_with(')') {
            if let Some(open_paren) = stem.rfind('(') {
                let inside = &stem[open_paren + 1 .. stem.len() - 1];
                if inside.chars().all(|c| c.is_ascii_digit()) {
                    let mut base_stem = &stem[..open_paren];
                    // Strip optional trailing space from base_stem
                    base_stem = base_stem.trim_end();
                    
                    // e.g., base="IMG_1234", counter="(1)", ext=".jpg"
                    // Google format: IMG_1234.jpg(1).json
                    return Some(format!("{}{}({}).json", base_stem, ext, inside));
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use crate::types::FileCategory;

    fn make_media(name: &str) -> MediaFile {
        MediaFile {
            source_path: PathBuf::from(name),
            category: FileCategory::Image,
            size_bytes: 100,
            hash: 0,
            albums: vec![],
            sidecar_path: None,
            match_strategy: None,
            resolved_metadata: None,
        }
    }

    fn make_json(name: &str) -> FileEntry {
        FileEntry {
            path: PathBuf::from(name),
            category: FileCategory::Json,
            size_bytes: 100,
            hash: None,
            album: None,
        }
    }

    #[test]
    fn test_generate_repositioned_counter_name() {
        assert_eq!(
            generate_repositioned_counter_name("IMG_1234(1).jpg"),
            Some("IMG_1234.jpg(1).json".to_string())
        );
        assert_eq!(
            generate_repositioned_counter_name("video(2).mp4"),
            Some("video.mp4(2).json".to_string())
        );
        assert_eq!(
            generate_repositioned_counter_name("IMG_1234.jpg"),
            None
        );
    }

    #[test]
    fn test_match_metadata_strategies() {
        let media = vec![
            make_media("exact_ext.jpg"),
            make_media("exact_noext.jpg"),
            make_media("very_long_file_name_that_gets_truncated_by_google_1234.jpg"),
            make_media("IMG_001(1).jpg"),
            make_media("fuzzy_match.jpg"),
        ];

        let jsons = vec![
            make_json("exact_ext.jpg.json"),
            make_json("exact_noext.json"),
            make_json("very_long_file_name_that_gets_truncated_by_go.json"),
            make_json("IMG_001.jpg(1).json"),
            make_json("fuzz_match.json"),
            make_json("orphaned.json"),
        ];

        let result = match_metadata(media, jsons);

        assert_eq!(result.matched_files.len(), 5);
        
        let exact_ext = result.matched_files.iter().find(|m| m.source_path.file_name().unwrap() == "exact_ext.jpg").unwrap();
        assert_eq!(exact_ext.match_strategy, Some(MatchStrategy::ExactWithExtension));
        
        let exact_noext = result.matched_files.iter().find(|m| m.source_path.file_name().unwrap() == "exact_noext.jpg").unwrap();
        assert_eq!(exact_noext.match_strategy, Some(MatchStrategy::ExactWithoutExtension));
        
        let trunc = result.matched_files.iter().find(|m| m.source_path.file_name().unwrap() == "very_long_file_name_that_gets_truncated_by_google_1234.jpg").unwrap();
        assert_eq!(trunc.match_strategy, Some(MatchStrategy::TruncatedPrefix));

        let repo = result.matched_files.iter().find(|m| m.source_path.file_name().unwrap() == "IMG_001(1).jpg").unwrap();
        assert_eq!(repo.match_strategy, Some(MatchStrategy::CounterReposition));

        let fuzz = result.matched_files.iter().find(|m| m.source_path.file_name().unwrap() == "fuzzy_match.jpg").unwrap();
        assert_eq!(fuzz.match_strategy, Some(MatchStrategy::FuzzyLevenshtein));

        assert_eq!(result.orphaned_sidecars.len(), 1);
        assert_eq!(result.orphaned_sidecars[0].file_name().unwrap(), "orphaned.json");
    }
}
