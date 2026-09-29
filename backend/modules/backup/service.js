'use strict';

const path = require('path');
const {
    exportUserData,
    importUserData,
    validateBackupData,
    saveBackup,
    listBackups,
    getBackup,
    deleteBackup,
    getBackupsDirectory,
    checkVersionCompatibility,
    readBackupFile,
} = require('../../services/backupService');
const { Backup } = require('../../models');
const zlib = require('zlib');
const { promisify } = require('util');
const {
    KIND: INSTANCE_KIND,
    exportInstance,
    importInstance,
    validateInstanceBackup,
} = require('../../services/instanceTransfer');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { gunzipWithLimit } = require('../../utils/safe-gunzip');

async function parseUploadedBackup(fileBuffer, filename) {
    let backupJson;

    const isGzipped =
        filename.toLowerCase().endsWith('.gz') ||
        (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b);

    if (isGzipped) {
        const decompressed = await gunzipWithLimit(fileBuffer);
        backupJson = decompressed.toString('utf8');
    } else {
        backupJson = fileBuffer.toString('utf8');
    }

    return JSON.parse(backupJson);
}

// A backup of all accounts restores only through the admin restore, which
// recreates the accounts; the single-account restore would drop them.
function refuseInstanceBackup(backupData) {
    if (backupData && backupData.kind === INSTANCE_KIND) {
        throw new ValidationError(
            'This file is a backup of all accounts. An admin can restore it under "All accounts" on the Backup page.'
        );
    }
}

const gzip = promisify(zlib.gzip);

class BackupService {
    async exportData(userId) {
        const backupData = await exportUserData(userId);
        const backup = await saveBackup(userId, backupData);
        return {
            success: true,
            message: 'Backup created successfully',
            backup: {
                uid: backup.uid,
                file_size: backup.file_size,
                item_counts: backup.item_counts,
                created_at: backup.created_at,
            },
        };
    }

    async importData(userId, file, options = {}) {
        if (!file) {
            throw new ValidationError('No backup file provided');
        }

        let backupData;
        try {
            backupData = await parseUploadedBackup(
                file.buffer,
                file.originalname
            );
        } catch (parseError) {
            throw new ValidationError(
                `Invalid backup file: ${parseError.message}`
            );
        }

        refuseInstanceBackup(backupData);

        const validation = validateBackupData(backupData);
        if (!validation.valid) {
            const error = new ValidationError('Invalid backup data');
            error.errors = validation.errors;
            throw error;
        }

        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            const error = new ValidationError('Version incompatible');
            error.versionMessage = versionCheck.message;
            error.backupVersion = backupData.version;
            throw error;
        }

        const importOptions = {
            merge: options.merge !== 'false',
        };

        const stats = await importUserData(userId, backupData, importOptions);

        return {
            success: true,
            message: 'Backup imported successfully',
            stats,
        };
    }

    async validateBackup(userId, file) {
        if (!file) {
            throw new ValidationError('No backup file provided');
        }

        let backupData;
        try {
            backupData = await parseUploadedBackup(
                file.buffer,
                file.originalname
            );
        } catch (parseError) {
            const error = new ValidationError('Invalid backup file');
            error.parseMessage = parseError.message;
            throw error;
        }

        refuseInstanceBackup(backupData);

        const validation = validateBackupData(backupData);

        if (!validation.valid) {
            const error = new ValidationError('Invalid backup data');
            error.errors = validation.errors;
            throw error;
        }

        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            const error = new ValidationError('Version incompatible');
            error.versionIncompatible = true;
            error.versionMessage = versionCheck.message;
            error.backupVersion = backupData.version;
            throw error;
        }

        const summary = {
            areas: backupData.data.areas?.length || 0,
            projects: backupData.data.projects?.length || 0,
            tasks: backupData.data.tasks?.length || 0,
            tags: backupData.data.tags?.length || 0,
            notes: backupData.data.notes?.length || 0,
            inbox_items: backupData.data.inbox_items?.length || 0,
            views: backupData.data.views?.length || 0,
        };

        return {
            valid: true,
            message: 'Backup file is valid',
            version: backupData.version,
            exported_at: backupData.exported_at,
            summary,
        };
    }

    async listBackups(userId) {
        const backups = await listBackups(userId, 5);
        return {
            success: true,
            backups,
        };
    }

    async downloadBackup(userId, uid) {
        const backup = await Backup.findOne({
            where: { uid, user_id: userId },
        });

        if (!backup) {
            throw new NotFoundError('Backup not found');
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        const fileBuffer = await readBackupFile(filePath);
        const isCompressed = backup.file_path.endsWith('.gz');
        const filename = `tududi-backup-${new Date().toISOString().split('T')[0]}${isCompressed ? '.json.gz' : '.json'}`;
        const contentType = isCompressed
            ? 'application/gzip'
            : 'application/json';

        return {
            fileBuffer,
            filename,
            contentType,
        };
    }

    async restoreBackup(userId, uid, options = {}) {
        const backupData = await getBackup(userId, uid);
        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            const error = new ValidationError('Version incompatible');
            error.versionMessage = versionCheck.message;
            error.backupVersion = backupData.version;
            throw error;
        }

        const restoreOptions = {
            merge: options.merge !== false,
        };

        const stats = await importUserData(userId, backupData, restoreOptions);

        return {
            success: true,
            message: 'Backup restored successfully',
            stats,
        };
    }

    async exportInstance() {
        const data = await exportInstance();
        const fileBuffer = await gzip(Buffer.from(JSON.stringify(data)));
        const date = new Date().toISOString().split('T')[0];
        return {
            fileBuffer,
            filename: `tududi-all-accounts-${date}.json.gz`,
            contentType: 'application/gzip',
        };
    }

    async importInstance(file) {
        if (!file) {
            throw new ValidationError('No backup file provided');
        }

        let backupData;
        try {
            backupData = await parseUploadedBackup(
                file.buffer,
                file.originalname
            );
        } catch (parseError) {
            throw new ValidationError(
                `Invalid backup file: ${parseError.message}`
            );
        }

        const validation = validateInstanceBackup(backupData);
        if (!validation.valid) {
            const error = new ValidationError('Invalid backup data');
            error.errors = validation.errors;
            throw error;
        }

        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            const error = new ValidationError('Version incompatible');
            error.versionMessage = versionCheck.message;
            error.backupVersion = backupData.version;
            throw error;
        }

        const result = await importInstance(backupData);
        return {
            success: true,
            message: 'Backup of all accounts restored',
            ...result,
        };
    }

    async deleteBackup(userId, uid) {
        await deleteBackup(userId, uid);
        return {
            success: true,
            message: 'Backup deleted successfully',
        };
    }
}

module.exports = new BackupService();
