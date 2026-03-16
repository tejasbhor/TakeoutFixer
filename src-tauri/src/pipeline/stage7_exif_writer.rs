use std::fs::File;
use std::io::Write;
use std::path::Path;
use anyhow::Result;
use tracing::warn;
// Redundant top-level imports removed

use crate::types::{FileCategory, MediaFile, ResolvedMetadata};

/// Write resolved metadata into the image/video file and set the OS modification time.
pub fn embed_metadata(media: &MediaFile, output_path: &Path) -> Result<()> {
    if let Some(meta) = &media.resolved_metadata {
        // Only attempt EXIF write if we actually have data to write
        let has_gps = meta.latitude.is_some() && meta.longitude.is_some();
        let has_desc = meta.description.is_some();
        let has_time = meta.datetime_original.is_some();

        if !has_gps && !has_desc && !has_time {
            // Nothing to embed, just copy
            std::fs::copy(&media.source_path, output_path)?;
        } else {
            // Dispatch based on file type
            let ext = media.source_path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or_default()
                .to_lowercase();

            let write_result = match media.category {
                FileCategory::Image => {
                    match ext.as_str() {
                        "jpg" | "jpeg" => embed_jpeg(&media.source_path, output_path, meta),
                        "png" => embed_png(&media.source_path, output_path, meta),
                        "heic" | "heif" => embed_heic(&media.source_path, output_path, meta),
                        "tiff" | "tif" => embed_tiff(&media.source_path, output_path, meta),
                        "gif" => write_xmp_sidecar(&media.source_path, output_path, meta),
                        _ => {
                            // Unsupported image format for embedding — just copy
                            std::fs::copy(&media.source_path, output_path)?;
                            Ok(())
                        }
                    }
                }
                FileCategory::Video => embed_video(&media.source_path, output_path, meta),
                FileCategory::RawImage => write_xmp_sidecar(&media.source_path, output_path, meta),
                _ => {
                    std::fs::copy(&media.source_path, output_path)?;
                    Ok(())
                }
            };

            if let Err(e) = write_result {
                warn!("EXIF rewrite failed for {}: {}. Falling back to clean copy.", media.source_path.display(), e);
                std::fs::copy(&media.source_path, output_path)?;
            }
        }

        if let Some(dt) = meta.datetime_original {
            if let Err(e) = set_creation_and_mtime(output_path, dt.timestamp()) {
                warn!("Could not set file times for {}: {}", output_path.display(), e);
            }
        }
    } else {
        // No metadata resolved, just copy the file
        std::fs::copy(&media.source_path, output_path)?;
    }

    Ok(())
}

/// Set both modification and creation time of a file (OS-dependent).
pub fn set_creation_and_mtime(path: &Path, timestamp: i64) -> Result<()> {
    use filetime::{set_file_mtime, FileTime};
    
    let ft = FileTime::from_unix_time(timestamp, 0);
    
    // 1. Set modification time (cross-platform)
    set_file_mtime(path, ft)?;

    // 2. Set creation time (Windows & macOS)
    #[cfg(windows)]
    {
        use windows_sys::Win32::Storage::FileSystem::{
            SetFileAttributesW, GetFileAttributesW, CreateFileW, 
            SetFileTime as WinSetFileTime, FILE_ATTRIBUTE_READONLY,
            FILE_WRITE_ATTRIBUTES, OPEN_EXISTING, 
            FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_SHARE_DELETE
        };
        use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
        
        // Convert path to wide string for Windows API
        let path_str = path.to_string_lossy();
        let wide: Vec<u16> = path_str.encode_utf16().chain(std::iter::once(0)).collect();
        
        // Clear Read-Only attribute if present
        let attrs = unsafe { GetFileAttributesW(wide.as_ptr()) };
        if attrs != 0xFFFFFFFF && (attrs & FILE_ATTRIBUTE_READONLY) != 0 {
            unsafe { SetFileAttributesW(wide.as_ptr(), attrs & !FILE_ATTRIBUTE_READONLY) };
        }

        let intervals = (timestamp + 11644473600) * 10_000_000;
        let file_time = windows_sys::Win32::Foundation::FILETIME {
            dwLowDateTime: (intervals & 0xFFFFFFFF) as u32,
            dwHighDateTime: (intervals >> 32) as u32,
        };

        // Set creation, last access, and last write times
        let mut success = false;
        for _ in 0..5 {
            let handle = unsafe {
                CreateFileW(
                    wide.as_ptr(),
                    FILE_WRITE_ATTRIBUTES,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                    std::ptr::null(),
                    OPEN_EXISTING,
                    0,
                    std::ptr::null_mut()
                )
            };

            if handle != INVALID_HANDLE_VALUE {
                unsafe {
                    if WinSetFileTime(handle, &file_time, &file_time, &file_time) != 0 {
                        success = true;
                    }
                    windows_sys::Win32::Foundation::CloseHandle(handle);
                }
                if success { break; }
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        if !success {
            warn!("Failed to set Windows creation time for {} after multiple retries.", path.display());
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::os::unix::ffi::OsStrExt;
        use std::ffi::CString;

        if let Ok(path_cstr) = CString::new(path.as_os_str().as_bytes()) {
            #[repr(C)]
            struct AttrBuf {
                size: u32,
                crtime: libc::timespec,
            }

            let mut attr_list: libc::attrlist = unsafe { std::mem::zeroed() };
            attr_list.bitmapcount = libc::ATTR_BIT_MAP_COUNT;
            attr_list.commonattr = libc::ATTR_CMN_CRTIME;

            let buf = AttrBuf {
                size: std::mem::size_of::<AttrBuf>() as u32,
                crtime: libc::timespec {
                    tv_sec: timestamp as libc::time_t,
                    tv_nsec: 0,
                },
            };

            // Retry loop for macOS if file is temporarily busy
            let mut success = false;
            for _ in 0..3 {
                let res = unsafe {
                    libc::setattrlist(
                        path_cstr.as_ptr(),
                        &attr_list as *const _ as *mut _,
                        &buf as *const _ as *mut _,
                        std::mem::size_of::<AttrBuf>(),
                        0,
                    )
                };
                if res == 0 {
                    success = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            
            if !success {
                warn!("Failed to set macOS birthtime for {} after retries", path.display());
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // On Linux, creation time isn't standardly mutable via libc, 
        // but we already set mtime via 'filetime' crate at the start of this function.
        // Most Linux gallery apps (Shotwell, DigiKam) use mtime if EXIF is missing.
    }

    Ok(())
}

fn embed_jpeg(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    use little_exif::metadata::Metadata;
    use little_exif::exif_tag::ExifTag;
    
    // Copy file first to work on the output copy
    std::fs::copy(input, output)?;
    
    // We wrap Metadata::new_from_path to catch decoding errors quietly
    // little_exif 0.6.23 logs to stderr even on non-fatal decoding issues
    let mut metadata = match Metadata::new_from_path(output) {
        Ok(m) => m,
        Err(_) => {
            // If the library can't even read the file, it's likely stripped or malformed.
            // We return an error here so the parent can fallback to a clean copy.
            return Err(anyhow::anyhow!("File has no EXIF or is malformed for little_exif"));
        }
    };
    
    // 1. Timestamp
    if let Some(dt) = meta.datetime_original {
        let date_str = dt.format("%Y:%m:%d %H:%M:%S").to_string();
        metadata.set_tag(ExifTag::DateTimeOriginal(date_str));
    }
    
    // 2. GPS
    if let (Some(lat), Some(lon)) = (meta.latitude, meta.longitude) {
        metadata.set_tag(ExifTag::GPSLatitude(decimal_to_dms(lat.abs())));
        metadata.set_tag(ExifTag::GPSLatitudeRef((if lat >= 0.0 { "N" } else { "S" }).to_string()));
        metadata.set_tag(ExifTag::GPSLongitude(decimal_to_dms(lon.abs())));
        metadata.set_tag(ExifTag::GPSLongitudeRef((if lon >= 0.0 { "E" } else { "W" }).to_string()));
        
        if let Some(alt) = meta.altitude {
            metadata.set_tag(ExifTag::GPSAltitude(vec![little_exif::rational::uR64 { nominator: alt.abs() as u32, denominator: 1 }]));
            metadata.set_tag(ExifTag::GPSAltitudeRef(vec![if alt >= 0.0 { 0 } else { 1 }]));
        }
    }
    
    // 3. Description
    let mut final_desc = meta.description.clone().unwrap_or_default();
    if !meta.people.is_empty() {
        let people_list = meta.people.join(", ");
        if !final_desc.is_empty() { final_desc.push_str("\n\nPeople: "); }
        else { final_desc.push_str("People: "); }
        final_desc.push_str(&people_list);
    }

    if !final_desc.is_empty() {
        metadata.set_tag(ExifTag::UserComment(final_desc.as_bytes().to_vec()));
    }
    
    // Write metadata to file
    metadata.write_to_file(output).map_err(|e| anyhow::anyhow!(e))?;
    
    Ok(())
}

fn decimal_to_dms(decimal: f64) -> Vec<little_exif::rational::uR64> {
    use little_exif::rational::uR64;
    let degrees = decimal.abs().floor();
    let minutes = ((decimal.abs() - degrees) * 60.0).floor();
    let seconds = (decimal.abs() - degrees - minutes / 60.0) * 3600.0;
    vec![
        uR64 { nominator: degrees as u32, denominator: 1 },
        uR64 { nominator: minutes as u32, denominator: 1 },
        uR64 { nominator: (seconds * 1000.0) as u32, denominator: 1000 },
    ]
}

fn embed_png(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    // PNG metadata via little_exif
    embed_jpeg(input, output, meta)
}

fn embed_heic(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    // Current MVP: HEIC/RAW metadata via XMP sidecar
    std::fs::copy(input, output)?;
    let xmp_path = output.with_extension("xmp");
    write_xmp_content(&xmp_path, meta)?;
    Ok(())
}

fn embed_tiff(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    // TIFF also supported by little_exif
    embed_jpeg(input, output, meta)
}

fn embed_video(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    // Filesystem fix handled by set_creation_and_mtime in parent
    std::fs::copy(input, output)?;
    
    // We also write an XMP sidecar for videos to handle GPS/Description professionally
    let xmp_path = output.with_extension(format!("{}.xmp", output.extension().and_then(|e| e.to_str()).unwrap_or("mp4")));
    write_xmp_content(&xmp_path, meta)?;
    Ok(())
}

fn write_xmp_sidecar(input: &Path, output: &Path, meta: &ResolvedMetadata) -> Result<()> {
    std::fs::copy(input, output)?;
    let xmp_path = output.with_extension("xmp");
    write_xmp_content(&xmp_path, meta)?;
    Ok(())
}

fn write_xmp_content(path: &Path, meta: &ResolvedMetadata) -> Result<()> {
    let mut file = File::create(path)?;
    writeln!(file, "<x:xmpmeta xmlns:x='adobe:ns:meta/'>")?;
    writeln!(file, " <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>")?;
    writeln!(file, "  <rdf:Description rdf:about=''")?;
    writeln!(file, "    xmlns:dc='http://purl.org/dc/elements/1.1/'")?;
    writeln!(file, "    xmlns:xmp='http://ns.adobe.com/xap/1.0/'")?;
    writeln!(file, "    xmlns:photoshop='http://ns.adobe.com/photoshop/1.0/'")?;
    writeln!(file, "    xmlns:exif='http://ns.adobe.com/exif/1.0/'>")?;
    
    // 1. Timestamp
    if let Some(dt) = &meta.datetime_original {
        let iso8601 = dt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
        writeln!(file, "   <xmp:CreateDate>{}</xmp:CreateDate>", iso8601)?;
        writeln!(file, "   <photoshop:DateCreated>{}</photoshop:DateCreated>", iso8601)?;
    }

    // 2. GPS
    if let (Some(lat), Some(lon)) = (meta.latitude, meta.longitude) {
        writeln!(file, "   <exif:GPSLatitude>{}</exif:GPSLatitude>", format_gps_xmp(lat, true))?;
        writeln!(file, "   <exif:GPSLongitude>{}</exif:GPSLongitude>", format_gps_xmp(lon, false))?;
        if let Some(alt) = meta.altitude {
            writeln!(file, "   <exif:GPSAltitude>{}/1</exif:GPSAltitude>", alt.abs() as i32)?;
            writeln!(file, "   <exif:GPSAltitudeRef>{}</exif:GPSAltitudeRef>", if alt >= 0.0 { 0 } else { 1 })?;
        }
    }

    // 3. Description
    if let Some(desc) = &meta.description {
        writeln!(file, "   <dc:description><rdf:Alt><rdf:li xml:lang='x-default'>{}</rdf:li></rdf:Alt></dc:description>", desc)?;
    }

    // 4. People (Subject)
    if !meta.people.is_empty() {
        writeln!(file, "   <dc:subject><rdf:Bag>")?;
        for person in &meta.people {
            writeln!(file, "    <rdf:li>{}</rdf:li>", person)?;
        }
        writeln!(file, "   </rdf:Bag></dc:subject>")?;
    }
    
    writeln!(file, "  </rdf:Description>")?;
    writeln!(file, " </rdf:RDF>")?;
    writeln!(file, "</x:xmpmeta>")?;
    Ok(())
}

fn format_gps_xmp(val: f64, is_lat: bool) -> String {
    let degrees = val.abs().floor();
    let minutes = ((val.abs() - degrees) * 60.0).floor();
    let seconds = (val.abs() - degrees - minutes / 60.0) * 3600.0;
    let ref_char = if is_lat {
        if val >= 0.0 { "N" } else { "S" }
    } else {
        if val >= 0.0 { "E" } else { "W" }
    };
    format!("{:.0},{:.0},{:.2}{}", degrees, minutes, seconds, ref_char)
}
