'use strict';

const path = require('path');
const fs = require('fs').promises;
const zlib = require('zlib');
const { promisify } = require('util');
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
} = require('../../services/backupService');
const { Backup } = require('../../models');
const { NotFoundError, ValidationError } = require('../../shared/errors');

const gunzip = promisify(zlib.gunzip);

async function parseUploadedBackup(fileBuffer, filename) {
    let backupJson;

    const isGzipped =
        filename.toLowerCase().endsWith('.gz') ||
        (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b);

    if (isGzipped) {
        const decompressed = await gunzip(fileBuffer);
        backupJson = decompressed.toString('utf8');
    } else {
        backupJson = fileBuffer.toString('utf8');
    }

    return JSON.parse(backupJson);
}

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

        const fileBuffer = await fs.readFile(filePath);
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

    async deleteBackup(userId, uid) {
        await deleteBackup(userId, uid);
        return {
            success: true,
            message: 'Backup deleted successfully',
        };
    }
}

module.exports = new BackupService();
