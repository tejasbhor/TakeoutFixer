use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use chrono::{Datelike, Utc};
use anyhow::Result;

use crate::types::{MediaFile, OutputMode, RunSummary};

/// Determine output paths, resolve filename collisions, and write the processing report.
pub fn calculate_output_paths(
    working_set: &[MediaFile],
    output_dir: &Path,
    mode: &OutputMode,
) -> Vec<(usize, PathBuf)> { // returns (index_in_working_set, target_path)
    let mut results = Vec::new();
    let mut name_registry: HashMap<String, u32> = HashMap::new();

    for (i, media) in working_set.iter().enumerate() {
        // Resolve target directory based on mode
        let mut target_dir = output_dir.to_path_buf();

        match mode {
            OutputMode::Flat => {
                // target_dir is just output_dir
            }
            OutputMode::ByYearMonth => {
                if let Some(meta) = &media.resolved_metadata {
                    if let Some(dt) = meta.datetime_original {
                        let year = dt.year();
                        let month = dt.month();
                        let month_name = match month {
                            1 => "01 - January",
                            2 => "02 - February",
                            3 => "03 - March",
                            4 => "04 - April",
                            5 => "05 - May",
                            6 => "06 - June",
                            7 => "07 - July",
                            8 => "08 - August",
                            9 => "09 - September",
                            10 => "10 - October",
                            11 => "11 - November",
                            12 => "12 - December",
                            _ => "Unknown",
                        };
                        target_dir = output_dir.join(format!("{:04}", year)).join(month_name);
                    } else {
                        target_dir = output_dir.join("undated");
                    }
                } else {
                    target_dir = output_dir.join("undated");
                }
            }
            OutputMode::PreserveAlbums => {
                if let Some(album) = media.albums.first() {
                    target_dir = output_dir.join(sanitize_path(album));
                } else {
                    target_dir = output_dir.join("unsorted");
                }
            }
        }

        // Resolve filename collisions in the target directory
        let orig_name = media.source_path.file_name().unwrap_or_default().to_string_lossy();
        let registry_key = format!("{}/{}", target_dir.display(), orig_name);
        
        let count = name_registry.entry(registry_key).or_insert(0);
        let final_name = if *count == 0 {
            *count = 1;
            orig_name.to_string()
        } else {
            *count += 1;
            let n = *count;
            if let Some(dot_pos) = orig_name.rfind('.') {
                format!("{}_{}{}", &orig_name[..dot_pos], n, &orig_name[dot_pos..])
            } else {
                format!("{}_{}", orig_name, n)
            }
        };

        results.push((i, target_dir.join(final_name)));
    }

    results
}

fn sanitize_path(name: &str) -> String {
    name.replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "_")
}

pub fn write_report(path: &Path, summary: &RunSummary, unmatched_sidecars: &[PathBuf]) -> Result<()> {
    let mut file = File::create(path)?;

    writeln!(file, "===================================================")?;
    writeln!(file, " TakeoutFixer Processing Report")?;
    writeln!(file, " Date: {}", Utc::now().to_rfc3339())?;
    writeln!(file, "===================================================")?;
    writeln!(file, "")?;
    writeln!(file, "SUMMARY")?;
    writeln!(file, "---------------------------------------------------")?;
    writeln!(file, "Files processed successfully : {}", summary.processed_ok)?;
    writeln!(file, "Duplicates removed           : {}", summary.duplicates_removed)?;
    writeln!(file, "Errors encountered           : {}", summary.errors)?;
    writeln!(file, "Skipped files                : {}", summary.skipped)?;
    writeln!(file, "Undated files (no timestamp) : {}", summary.undated_files)?;
    writeln!(file, "Orphaned JSON sidecars       : {}", summary.unmatched_sidecars)?;
    writeln!(file, "Elapsed time                 : {:.1} seconds", summary.elapsed_seconds)?;
    
    writeln!(file, "\nORPHANED SIDECARS")?;
    writeln!(file, "---------------------------------------------------")?;
    if unmatched_sidecars.is_empty() {
        writeln!(file, "None.")?;
    } else {
        for s in unmatched_sidecars {
            writeln!(file, "{}", s.display())?;
        }
    }

    Ok(())
}
