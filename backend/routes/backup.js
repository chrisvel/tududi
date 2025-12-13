const express = require('express');
const { logError } = require('../services/logService');
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
} = require('../services/backupService');
const { Backup } = require('../models');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');
const multer = require('multer');
const zlib = require('zlib');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);

const checkBackupsEnabled = (req, res, next) => {
    const backupsEnabled = process.env.FF_ENABLE_BACKUPS === 'true';
    if (!backupsEnabled) {
        return res.status(403).json({
            error: 'Backups feature is disabled',
            message:
                'The backups feature is currently disabled. Please contact your administrator.',
        });
    }
    next();
};

router.use(checkBackupsEnabled);

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
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/json',
            'application/gzip',
            'application/x-gzip',
        ];
        const fileExt = file.originalname.toLowerCase();

        if (
            allowedMimes.includes(file.mimetype) ||
            fileExt.endsWith('.json') ||
            fileExt.endsWith('.gz')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only JSON and gzip files are allowed'), false);
        }
    },
});
router.post('/export', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const backupData = await exportUserData(userId);

        const backup = await saveBackup(userId, backupData);
        res.json({
            success: true,
            message: 'Backup created successfully',
            backup: {
                uid: backup.uid,
                file_size: backup.file_size,
                item_counts: backup.item_counts,
                created_at: backup.created_at,
            },
        });
    } catch (error) {
        logError('Error exporting user data:', error);
        res.status(500).json({
            error: 'Failed to export data',
            message: error.message,
        });
    }
});

router.post('/import', upload.single('backup'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No backup file provided' });
        }

        let backupData;
        try {
            backupData = await parseUploadedBackup(
                req.file.buffer,
                req.file.originalname
            );
        } catch (parseError) {
            return res.status(400).json({
                error: 'Invalid backup file',
                message: parseError.message,
            });
        }

        const validation = validateBackupData(backupData);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid backup data',
                errors: validation.errors,
            });
        }

        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                error: 'Version incompatible',
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
        }

        const options = {
            merge: req.body.merge !== 'false',
        };

        const stats = await importUserData(userId, backupData, options);

        res.json({
            success: true,
            message: 'Backup imported successfully',
            stats,
        });
    } catch (error) {
        logError('Error importing user data:', error);
        res.status(500).json({
            error: 'Failed to import data',
            message: error.message,
        });
    }
});

router.post('/validate', upload.single('backup'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No backup file provided' });
        }

        let backupData;
        try {
            backupData = await parseUploadedBackup(
                req.file.buffer,
                req.file.originalname
            );
        } catch (parseError) {
            return res.status(400).json({
                valid: false,
                error: 'Invalid backup file',
                message: parseError.message,
            });
        }

        const validation = validateBackupData(backupData);

        if (!validation.valid) {
            return res.status(400).json({
                valid: false,
                errors: validation.errors,
            });
        }

        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                valid: false,
                versionIncompatible: true,
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
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

        res.json({
            valid: true,
            message: 'Backup file is valid',
            version: backupData.version,
            exported_at: backupData.exported_at,
            summary,
        });
    } catch (error) {
        logError('Error validating backup file:', error);
        res.status(500).json({
            valid: false,
            error: 'Failed to validate backup file',
            message: error.message,
        });
    }
});

router.get('/list', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const backups = await listBackups(userId, 5);

        res.json({
            success: true,
            backups,
        });
    } catch (error) {
        logError('Error listing backups:', error);
        res.status(500).json({
            error: 'Failed to list backups',
            message: error.message,
        });
    }
});

router.get('/:uid/download', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const backup = await Backup.findOne({
            where: { uid: req.params.uid, user_id: userId },
        });

        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        const fileBuffer = await fs.readFile(filePath);
        const isCompressed = backup.file_path.endsWith('.gz');
        const filename = `tududi-backup-${new Date().toISOString().split('T')[0]}${isCompressed ? '.json.gz' : '.json'}`;
        const contentType = isCompressed
            ? 'application/gzip'
            : 'application/json';
        res.setHeader('Content-Type', contentType);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        res.setHeader('Content-Length', fileBuffer.length);

        res.send(fileBuffer);
    } catch (error) {
        logError('Error downloading backup:', error);
        res.status(500).json({
            error: 'Failed to download backup',
            message: error.message,
        });
    }
});

router.post('/:uid/restore', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const backupData = await getBackup(userId, req.params.uid);
        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                error: 'Version incompatible',
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
        }

        const options = {
            merge: req.body.merge !== false,
        };

        const stats = await importUserData(userId, backupData, options);

        res.json({
            success: true,
            message: 'Backup restored successfully',
            stats,
        });
    } catch (error) {
        logError('Error restoring backup:', error);
        res.status(500).json({
            error: 'Failed to restore backup',
            message: error.message,
        });
    }
});

router.delete('/:uid', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        await deleteBackup(userId, req.params.uid);

        res.json({
            success: true,
            message: 'Backup deleted successfully',
        });
    } catch (error) {
        logError('Error deleting backup:', error);
        res.status(500).json({
            error: 'Failed to delete backup',
            message: error.message,
        });
    }
});

module.exports = router;
