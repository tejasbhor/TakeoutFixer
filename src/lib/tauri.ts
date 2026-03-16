import { invoke } from '@tauri-apps/api/core';
import type { JobConfig, RunSummary, ValidationResult } from '../types';

export async function validateInput(paths: string[]): Promise<ValidationResult> {
    return invoke('validate_input', { paths });
}

export async function startProcessing(config: JobConfig): Promise<RunSummary> {
    return invoke('start_processing', { config });
}

export async function cancelProcessing(): Promise<void> {
    return invoke('cancel_processing');
}

export async function openOutputFolder(path: string): Promise<void> {
    return invoke('open_output_folder', { path });
}

export async function getHistory(): Promise<RunSummary[]> {
    return invoke('get_history');
}

export async function clearHistory(): Promise<void> {
    return invoke('clear_history');
}
