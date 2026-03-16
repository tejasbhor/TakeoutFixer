export type OutputMode = 'flat' | 'byYearMonth' | 'preserveAlbums';

export type DuplicateAction = 'moveToFolder' | 'discard';

export interface JobConfig {
    inputPaths: string[];
    outputPath: string;
    outputMode: OutputMode;
    duplicateAction: DuplicateAction;
    dryRun: boolean;
    hwAcceleration: boolean;
}

export interface ProgressEvent {
    stage: number;
    stageName: string;
    current: number;
    total: number;
    processed: number;
    skipped: number;
    errors: number;
    currentFile: string | null;
    message: string | null;
}

export interface ArchiveInfo {
    path: string;
    sizeBytes: number;
    segmentIndex: number | null;
    isValid: boolean;
    error: string | null;
}

export type WarningKind = 'missingSegment' | 'lowDiskSpace' | 'corruptArchive' | 'duplicateArchive';

export interface ValidationWarning {
    kind: WarningKind;
    message: string;
}

export interface ValidationResult {
    archives: ArchiveInfo[];
    warnings: ValidationWarning[];
    estimatedExtractedGb: number;
    hasErrors: boolean;
}

export interface RunSummary {
    totalInputFiles: number;
    processedOk: number;
    skipped: number;
    errors: number;
    duplicatesRemoved: number;
    undatedFiles: number;
    unmatchedSidecars: number;
    rawFiles: number;
    outputPath: string;
    logPath: string;
    elapsedSeconds: number;
    dryRun: boolean;
    runDate: string;
}
