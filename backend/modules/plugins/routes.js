'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();

const AppError = require('../../shared/errors/AppError');
const pluginsController = require('./controller');
const installer = require('./installer');
const { requirePluginManager } = require('./access');

const maxMegabytes = Math.floor(installer.MAX_ARCHIVE_BYTES / 1024 / 1024);

/**
 * The archive is buffered in memory rather than streamed to disk: it is capped
 * at a size a plugin is allowed to be, yauzl reads a buffer directly, and
 * nothing untrusted touches the filesystem before it has been validated. The
 * cap is enforced by multer while the upload is still arriving, so an oversized
 * file is refused rather than written out first.
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: installer.MAX_ARCHIVE_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const zipMimes = [
            'application/zip',
            'application/x-zip',
            'application/x-zip-compressed',
            'multipart/x-zip',
        ];

        // Browsers are inconsistent about a ZIP's content type - Chrome sends
        // application/zip, Windows sometimes sends octet-stream - so the
        // extension is the check that carries here. What the file actually
        // contains is decided by the installer, not by this.
        if (name.endsWith('.zip') || zipMimes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(
            new AppError(
                'Only a .zip archive can be installed.',
                400,
                'VALIDATION_ERROR'
            )
        );
    },
});

/**
 * Translate multer's own failures into the app's error shape. Without this an
 * oversized upload answers 500 and says nothing about the limit.
 */
const receiveArchive = (req, res, next) => {
    upload.single('plugin')(req, res, (error) => {
        if (!error) return next();

        if (error.code === 'LIMIT_FILE_SIZE') {
            return next(
                new AppError(
                    `The archive is larger than the ${maxMegabytes} MB a plugin upload may be.`,
                    413,
                    'VALIDATION_ERROR'
                )
            );
        }
        return next(error);
    });
};

// Mounted under both /api and /api/v1, behind requireAuth (see backend/app.js).
router.get('/plugins', pluginsController.list);
router.put('/plugins/state', pluginsController.updateState);
router.put('/plugins/:id', pluginsController.updatePlugin);

// Installing and removing change the server, not the account, so unlike the
// per-user routes above they are operator actions. A plugin replaced by
// uploading a newer archive of itself is the same request: the archive names
// its own plugin id.
router.post(
    '/plugins/install',
    requirePluginManager,
    receiveArchive,
    pluginsController.install
);
router.delete('/plugins/:id', requirePluginManager, pluginsController.remove);

module.exports = router;
