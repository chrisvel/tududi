'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireFeature } = require('../../middleware/entitlements');
const backupController = require('./controller');

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

router.use('/backup', checkBackupsEnabled);

router.post('/backup/export', backupController.export);
router.post(
    '/backup/import',
    requireFeature('backups_import'),
    upload.single('backup'),
    backupController.import
);
router.post(
    '/backup/validate',
    requireFeature('backups_import'),
    upload.single('backup'),
    backupController.validate
);
router.get('/backup/list', backupController.list);
router.get('/backup/:uid/download', backupController.download);
router.post(
    '/backup/:uid/restore',
    requireFeature('backups_import'),
    backupController.restore
);
router.delete('/backup/:uid', backupController.delete);

module.exports = router;
