import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateState = {
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error';
    update: Update | null;
    progress: number;
    error?: string;
};

export async function getUpdateMetadata(): Promise<Update | null> {
    try {
        return await check();
    } catch (e) {
        console.error('Failed to check for updates:', e);
        throw e;
    }
}

export async function installUpdate(
    update: Update, 
    onProgress: (progress: number) => void
) {
    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
            contentLength = event.data.contentLength || 0;
        } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
                onProgress(Math.round((downloaded / contentLength) * 100));
            }
        }
    });

    await relaunch();
}
