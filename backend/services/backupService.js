const {
    sequelize,
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    View,
    RecurringCompletion,
    TaskAttachment,
    Backup,
} = require('../models');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { getConfig } = require('../config/config');
const config = getConfig();
const packageJson = require('../../package.json');

// Promisify zlib functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Compare two semantic versions
 * @param {string} version1 - First version (e.g., "v0.88.0-dev.1")
 * @param {string} version2 - Second version
 * @returns {number} - Returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(version1, version2) {
    // Remove 'v' prefix if present
    const v1 = version1.replace(/^v/, '');
    const v2 = version2.replace(/^v/, '');

    // Split into parts (major.minor.patch-prerelease)
    const parseVersion = (v) => {
        const [mainVersion, prerelease] = v.split('-');
        const [major, minor, patch] = mainVersion.split('.').map(Number);
        return { major, minor, patch, prerelease };
    };

    const parsed1 = parseVersion(v1);
    const parsed2 = parseVersion(v2);

    // Compare major, minor, patch
    if (parsed1.major !== parsed2.major) return parsed1.major - parsed2.major;
    if (parsed1.minor !== parsed2.minor) return parsed1.minor - parsed2.minor;
    if (parsed1.patch !== parsed2.patch) return parsed1.patch - parsed2.patch;

    // If versions are equal so far, check prerelease
    // No prerelease is considered greater than prerelease
    if (!parsed1.prerelease && parsed2.prerelease) return 1;
    if (parsed1.prerelease && !parsed2.prerelease) return -1;
    if (parsed1.prerelease && parsed2.prerelease) {
        return parsed1.prerelease.localeCompare(parsed2.prerelease);
    }

    return 0;
}

/**
 * Check if backup version is compatible with current app version
 * @param {string} backupVersion - Version from backup file
 * @returns {object} - { compatible: boolean, message?: string }
 */
function checkVersionCompatibility(backupVersion) {
    const currentVersion = packageJson.version;

    // If backup version is newer than current version, it's not compatible
    const comparison = compareVersions(backupVersion, currentVersion);

    if (comparison > 0) {
        return {
            compatible: false,
            message: `Cannot restore backup from newer version ${backupVersion} to current version ${currentVersion}. Please upgrade your application first.`,
        };
    }

    return { compatible: true };
}

// Export and import live in userDataTransfer.js (format 2: uid references,
// embedded attachment files, goals and people).
const { exportUserData, importUserData } = require('./userDataTransfer');

/**
 * Validate backup data structure
 * @param {object} backupData - The backup data to validate
 * @returns {object} - Validation result with errors array
 */
function validateBackupData(backupData) {
    const errors = [];

    if (!backupData) {
        errors.push('Backup data is empty');
        return { valid: false, errors };
    }

    if (!backupData.version) {
        errors.push('Missing version field');
    }

    if (!backupData.data) {
        errors.push('Missing data field');
    }

    // Check data structure
    const requiredFields = ['areas', 'projects', 'tasks', 'tags', 'notes'];
    for (const field of requiredFields) {
        if (backupData.data && !Array.isArray(backupData.data[field])) {
            errors.push(`Invalid or missing data.${field} array`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get the backups directory path and ensure it exists
 * @returns {Promise<string>} - Path to backups directory
 */
async function getBackupsDirectory() {
    const backupsDir = path.join(__dirname, '../backups');
    try {
        await fs.access(backupsDir);
    } catch {
        await fs.mkdir(backupsDir, { recursive: true });
    }
    return backupsDir;
}

/**
 * Save backup to disk and create database record
 * @param {number} userId - The user ID
 * @param {object} backupData - The backup data
 * @returns {Promise<object>} - The created Backup record
 */
async function saveBackup(userId, backupData) {
    try {
        const backupsDir = await getBackupsDirectory();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-user-${userId}-${timestamp}.json.gz`;
        const filePath = path.join(backupsDir, fileName);

        // Convert backup to JSON string
        const backupJson = JSON.stringify(backupData, null, 2);

        // Compress using gzip
        const compressed = await gzip(backupJson);

        // Write compressed backup to file
        await fs.writeFile(filePath, compressed);

        // Get file stats
        const stats = await fs.stat(filePath);

        // Count items in backup
        const itemCounts = {
            areas: backupData.data.areas?.length || 0,
            projects: backupData.data.projects?.length || 0,
            tasks: backupData.data.tasks?.length || 0,
            tags: backupData.data.tags?.length || 0,
            notes: backupData.data.notes?.length || 0,
            inbox_items: backupData.data.inbox_items?.length || 0,
            views: backupData.data.views?.length || 0,
        };

        // Create database record
        const backup = await Backup.create({
            user_id: userId,
            file_path: fileName, // Store relative path
            file_size: stats.size, // Compressed size
            item_counts: itemCounts,
            version: backupData.version,
        });

        // Keep only last 5 backups for this user
        await cleanOldBackups(userId);

        return backup;
    } catch (error) {
        console.error('Error saving backup:', error);
        throw error;
    }
}

/**
 * Clean old backups, keeping only the last 5 for a user
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 */
async function cleanOldBackups(userId) {
    try {
        // Get all backups for user, ordered by creation date
        const backups = await Backup.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
        });

        // If more than 5, delete the oldest ones
        if (backups.length > 5) {
            const backupsToDelete = backups.slice(5);
            const backupsDir = await getBackupsDirectory();

            for (const backup of backupsToDelete) {
                // Delete file from disk
                const filePath = path.join(backupsDir, backup.file_path);
                try {
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error(
                        `Failed to delete backup file: ${filePath}`,
                        err
                    );
                }

                // Delete database record
                await backup.destroy();
            }
        }
    } catch (error) {
        console.error('Error cleaning old backups:', error);
    }
}

/**
 * List saved backups for a user
 * @param {number} userId - The user ID
 * @param {number} limit - Maximum number of backups to return (default: 5)
 * @returns {Promise<Array>} - Array of backup records
 */
async function listBackups(userId, limit = 5) {
    try {
        const backups = await Backup.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit,
            attributes: [
                'id',
                'uid',
                'file_path',
                'file_size',
                'item_counts',
                'version',
                'created_at',
            ],
        });

        return backups;
    } catch (error) {
        console.error('Error listing backups:', error);
        throw error;
    }
}

/**
 * Get a specific backup by UID
 * @param {number} userId - The user ID
 * @param {string} backupUid - The backup UID
 * @returns {Promise<object>} - The backup data
 */
async function getBackup(userId, backupUid) {
    try {
        const backup = await Backup.findOne({
            where: { uid: backupUid, user_id: userId },
        });

        if (!backup) {
            throw new Error('Backup not found');
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        // Read backup file
        const fileBuffer = await fs.readFile(filePath);

        // Check if file is compressed (ends with .gz)
        let backupJson;
        if (backup.file_path.endsWith('.gz')) {
            // Decompress gzip
            const decompressed = await gunzip(fileBuffer);
            backupJson = decompressed.toString('utf8');
        } else {
            // Legacy uncompressed backup
            backupJson = fileBuffer.toString('utf8');
        }

        const backupData = JSON.parse(backupJson);

        return backupData;
    } catch (error) {
        console.error('Error getting backup:', error);
        throw error;
    }
}

/**
 * Delete a specific backup
 * @param {number} userId - The user ID
 * @param {string} backupUid - The backup UID
 * @returns {Promise<void>}
 */
async function deleteBackup(userId, backupUid) {
    try {
        const backup = await Backup.findOne({
            where: { uid: backupUid, user_id: userId },
        });

        if (!backup) {
            throw new Error('Backup not found');
        }

        const backupsDir = await getBackupsDirectory();
        const filePath = path.join(backupsDir, backup.file_path);

        // Delete file from disk
        try {
            await fs.unlink(filePath);
        } catch (err) {
            console.error(`Failed to delete backup file: ${filePath}`, err);
        }

        // Delete database record
        await backup.destroy();
    } catch (error) {
        console.error('Error deleting backup:', error);
        throw error;
    }
}

module.exports = {
    exportUserData,
    importUserData,
    validateBackupData,
    saveBackup,
    listBackups,
    getBackup,
    deleteBackup,
    getBackupsDirectory,
    checkVersionCompatibility,
};
