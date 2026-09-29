'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireFeature } = require('../../middleware/entitlements');
const backupController = require('./controller');

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

// A backup of every account can be much larger than one account's.
const instanceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: upload.fileFilter,
});

router.post('/backup/export', backupController.export);
router.get(
    '/backup/instance/export',
    backupController.requireInstanceAdmin,
    backupController.exportInstance
);
router.post(
    '/backup/instance/import',
    backupController.requireInstanceAdmin,
    (req, res, next) => {
        instanceUpload.single('backup')(req, res, (err) => {
            if (err) return res.status(400).json({ error: err.message });
            next();
        });
    },
    backupController.importInstance
);
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
