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

/**
 * Parse uploaded backup file (handles both compressed and uncompressed)
 * @param {Buffer} fileBuffer - The uploaded file buffer
 * @param {string} filename - The original filename
 * @returns {Promise<object>} - Parsed backup data
 */
async function parseUploadedBackup(fileBuffer, filename) {
    let backupJson;

    // Check if file is gzipped (by extension or magic bytes)
    const isGzipped = filename.toLowerCase().endsWith('.gz') ||
        (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b); // gzip magic bytes

    if (isGzipped) {
        // Decompress gzip
        const decompressed = await gunzip(fileBuffer);
        backupJson = decompressed.toString('utf8');
    } else {
        // Plain JSON
        backupJson = fileBuffer.toString('utf8');
    }

    return JSON.parse(backupJson);
}

// Configure multer for file upload (in-memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept both JSON and gzip files
        const allowedMimes = ['application/json', 'application/gzip', 'application/x-gzip'];
        const fileExt = file.originalname.toLowerCase();

        if (allowedMimes.includes(file.mimetype) || fileExt.endsWith('.json') || fileExt.endsWith('.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Only JSON and gzip files are allowed'), false);
        }
    },
});

/**
 * POST /api/backup/export
 * Export user's data as JSON backup and save to server
 */
router.post('/backup/export', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const backupData = await exportUserData(userId);

        // Save backup to server
        const backup = await saveBackup(userId, backupData);

        // Return backup metadata for confirmation
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

/**
 * POST /api/backup/import
 * Import backup data from JSON file
 */
router.post('/backup/import', upload.single('backup'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No backup file provided' });
        }

        // Parse JSON from uploaded file (handles both compressed and uncompressed)
        let backupData;
        try {
            backupData = await parseUploadedBackup(req.file.buffer, req.file.originalname);
        } catch (parseError) {
            return res.status(400).json({
                error: 'Invalid backup file',
                message: parseError.message,
            });
        }

        // Validate backup data structure
        const validation = validateBackupData(backupData);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid backup data',
                errors: validation.errors,
            });
        }

        // Check version compatibility
        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                error: 'Version incompatible',
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
        }

        // Import data (merge by default)
        const options = {
            merge: req.body.merge !== 'false', // merge by default unless explicitly set to false
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

/**
 * POST /api/backup/validate
 * Validate backup file without importing
 */
router.post('/backup/validate', upload.single('backup'), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No backup file provided' });
        }

        // Parse JSON from uploaded file (handles both compressed and uncompressed)
        let backupData;
        try {
            backupData = await parseUploadedBackup(req.file.buffer, req.file.originalname);
        } catch (parseError) {
            return res.status(400).json({
                valid: false,
                error: 'Invalid backup file',
                message: parseError.message,
            });
        }

        // Validate backup data structure
        const validation = validateBackupData(backupData);

        if (!validation.valid) {
            return res.status(400).json({
                valid: false,
                errors: validation.errors,
            });
        }

        // Check version compatibility
        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                valid: false,
                versionIncompatible: true,
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
        }

        // Count items in backup
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

/**
 * GET /api/backup/list
 * List all saved backups for the current user
 */
router.get('/backup/list', async (req, res) => {
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

/**
 * GET /api/backup/:uid/download
 * Download a specific backup file
 */
router.get('/backup/:uid/download', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Find the backup record
        const backup = await Backup.findOne({
            where: { uid: req.params.uid, user_id: userId },
        });

        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        // Read the compressed file
        const fileBuffer = await fs.readFile(filePath);

        // Determine filename and content type
        const isCompressed = backup.file_path.endsWith('.gz');
        const filename = `tududi-backup-${new Date().toISOString().split('T')[0]}${isCompressed ? '.json.gz' : '.json'}`;
        const contentType = isCompressed ? 'application/gzip' : 'application/json';

        // Set headers for file download
        res.setHeader('Content-Type', contentType);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        res.setHeader('Content-Length', fileBuffer.length);

        // Send the file
        res.send(fileBuffer);
    } catch (error) {
        logError('Error downloading backup:', error);
        res.status(500).json({
            error: 'Failed to download backup',
            message: error.message,
        });
    }
});

/**
 * POST /api/backup/:uid/restore
 * Restore data from a saved backup
 */
router.post('/backup/:uid/restore', async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get the backup data
        const backupData = await getBackup(userId, req.params.uid);

        // Check version compatibility
        const versionCheck = checkVersionCompatibility(backupData.version);
        if (!versionCheck.compatible) {
            return res.status(400).json({
                error: 'Version incompatible',
                message: versionCheck.message,
                backupVersion: backupData.version,
            });
        }

        // Import data (merge by default)
        const options = {
            merge: req.body.merge !== false, // merge by default
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

/**
 * DELETE /api/backup/:uid
 * Delete a specific backup
 */
router.delete('/backup/:uid', async (req, res) => {
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
