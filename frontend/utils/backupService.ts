import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export interface BackupData {
    version: string;
    exported_at: string;
    user: {
        uid: string;
        email: string;
        name: string;
        surname: string;
        appearance: string;
        language: string;
        timezone: string;
        first_day_of_week: number;
        [key: string]: any;
    };
    data: {
        areas: any[];
        projects: any[];
        tasks: any[];
        tags: any[];
        notes: any[];
        inbox_items: any[];
        views: any[];
        task_events?: any[];
    };
}

export interface ImportStats {
    areas: { created: number; skipped: number };
    projects: { created: number; skipped: number };
    tasks: { created: number; skipped: number };
    tags: { created: number; skipped: number };
    notes: { created: number; skipped: number };
    inbox_items: { created: number; skipped: number };
    views: { created: number; skipped: number };
}

export interface ImportResult {
    success: boolean;
    message: string;
    stats: ImportStats;
}

export interface SavedBackup {
    id: number;
    uid: string;
    file_path: string;
    file_size: number;
    item_counts: {
        areas: number;
        projects: number;
        tasks: number;
        tags: number;
        notes: number;
        inbox_items: number;
        views: number;
    };
    version: string;
    created_at: string;
}

export interface BackupListResult {
    success: boolean;
    backups: SavedBackup[];
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
    version?: string;
    exported_at?: string;
    summary?: {
        areas: number;
        projects: number;
        tasks: number;
        tags: number;
        notes: number;
        inbox_items: number;
        views: number;
    };
    errors?: string[];
    versionIncompatible?: boolean;
    backupVersion?: string;
}

/**
 * Create a new backup on the server
 */
export const createBackup = async (): Promise<SavedBackup> => {
    const response = await fetch(getApiPath('backup/export'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to create backup.');
    const result = await response.json();
    return result.backup;
};

/**
 * List all saved backups
 */
export const listSavedBackups = async (): Promise<SavedBackup[]> => {
    const response = await fetch(getApiPath('backup/list'), {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to list backups.');
    const result: BackupListResult = await response.json();
    return result.backups;
};

/**
 * Download a saved backup as a compressed file
 */
export const downloadSavedBackup = async (backupUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`backup/${backupUid}/download`), {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/gzip, application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to download backup.');

    // Get the blob (compressed file)
    const blob = await response.blob();

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `tududi-backup-${new Date().toISOString().split('T')[0]}.json.gz`;

    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
            filename = filenameMatch[1];
        }
    }

    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Trigger the download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Restore from a saved backup
 */
export const restoreSavedBackup = async (
    backupUid: string,
    merge: boolean = true
): Promise<ImportResult> => {
    const response = await fetch(getApiPath(`backup/${backupUid}/restore`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ merge }),
    });

    await handleAuthResponse(response, 'Failed to restore backup.');
    return await response.json();
};

/**
 * Delete a saved backup
 */
export const deleteSavedBackup = async (backupUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`backup/${backupUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to delete backup.');
};

/**
 * Import backup data from a file
 */
export const importBackup = async (
    file: File,
    merge: boolean = true
): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('backup', file);
    formData.append('merge', merge.toString());

    const response = await fetch(getApiPath('backup/import'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    await handleAuthResponse(response, 'Failed to import backup.');
    return await response.json();
};

/**
 * Validate backup file without importing
 */
export const validateBackup = async (file: File): Promise<ValidationResult> => {
    const formData = new FormData();
    formData.append('backup', file);

    const response = await fetch(getApiPath('backup/validate'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        return {
            valid: false,
            message: error.error || 'Validation failed',
            errors: error.errors || [error.message],
        };
    }

    return await response.json();
};
