use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ─── Job Configuration (sent from frontend) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobConfig {
    /// Input ZIP paths or a single directory path
    pub input_paths: Vec<String>,
    /// Where to write the output
    pub output_path: String,
    /// How to organise output files
    pub output_mode: OutputMode,
    /// What to do with detected duplicates
    pub duplicate_action: DuplicateAction,
    /// If true, analyze only and don't write files
    pub dry_run: bool,
    /// If true, use GPU for processing (if applicable)
    pub hw_acceleration: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OutputMode {
    /// All photos in a single flat directory
    Flat,
    /// output/YYYY/MM/file.jpg
    ByYearMonth,
    /// output/AlbumName/file.jpg
    PreserveAlbums,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DuplicateAction {
    /// Move duplicates to output/duplicates/ subfolder (default, safer)
    MoveToFolder,
    /// Silently discard duplicates
    Discard,
}

// ─── Progress Events (emitted to frontend during processing) ──────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub stage: u8,
    pub stage_name: String,
    pub current: u64,
    pub total: u64,
    pub processed: u64,
    pub skipped: u64,
    pub errors: u64,
    pub current_file: Option<String>,
    pub message: Option<String>,
}

// ─── Validation Result ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub archives: Vec<ArchiveInfo>,
    pub warnings: Vec<ValidationWarning>,
    pub estimated_extracted_gb: f64,
    pub has_errors: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    pub path: String,
    pub size_bytes: u64,
    pub segment_index: Option<u32>,
    pub is_valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationWarning {
    pub kind: WarningKind,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WarningKind {
    MissingSegment,
    LowDiskSpace,
    CorruptArchive,
    DuplicateArchive,
}

// ─── File Classification ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileCategory {
    Image,
    Video,
    JsonSidecar,
    RawImage,
    Ignored,
    Unsorted,
}

#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: PathBuf,
    pub category: FileCategory,
    pub size_bytes: u64,
    pub hash: Option<u64>,
    pub album: Option<String>,
}

// ─── Matched Media File ──────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct MediaFile {
    pub source_path: PathBuf,
    pub category: FileCategory,
    pub size_bytes: u64,
    pub hash: u64,
    pub albums: Vec<String>,
    pub sidecar_path: Option<PathBuf>,
    pub match_strategy: Option<MatchStrategy>,
    pub resolved_metadata: Option<ResolvedMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MatchStrategy {
    ExactWithExtension,
    ExactWithoutExtension,
    TruncatedPrefix,
    CounterReposition,
    FuzzyLevenshtein,
    EditedVariant,
    LivePhotoComponent,
    SidecarTitleMatch,
    Unmatched,
}

// ─── Metadata from JSON Sidecar ──────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarJson {
    pub title: Option<String>,
    pub description: Option<String>,
    pub creation_time: Option<SidecarTimestamp>,
    pub photo_taken_time: Option<SidecarTimestamp>,
    pub geo_data: Option<SidecarGeo>,
    pub geo_data_exif: Option<SidecarGeo>,
    pub people: Option<Vec<SidecarPerson>>,
    pub url: Option<String>,
    pub google_photos_origin: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SidecarTimestamp {
    pub timestamp: Option<String>,
    pub formatted: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SidecarGeo {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    #[serde(rename = "latitudeSpan")]
    pub latitude_span: Option<f64>,
    #[serde(rename = "longitudeSpan")]
    pub longitude_span: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarPerson {
    pub name: Option<String>,
}

// ─── Resolved Metadata ───────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ResolvedMetadata {
    pub datetime_original: Option<DateTime<Utc>>,
    pub timestamp_source: TimestampSource,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    pub description: Option<String>,
    pub title: Option<String>,
    pub people: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimestampSource {
    JsonPhotoTakenTime,
    JsonCreationTime,
    ExifDateTimeOriginal,
    ExifDateTime,
    Filename,
    FileSystemMtime,
    Undated,
}

// ─── Run Summary ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub total_input_files: u64,
    pub processed_ok: u64,
    pub skipped: u64,
    pub errors: u64,
    pub duplicates_removed: u64,
    pub undated_files: u64,
    pub unmatched_sidecars: u64,
    pub raw_files: u64,
    pub output_path: String,
    pub log_path: String,
    pub elapsed_seconds: f64,
    pub dry_run: bool,
}
