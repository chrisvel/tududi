'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const { getExtensionFromMimeType } = require('../../utils/attachment-utils');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { requireFeature } = require('../../middleware/entitlements');
const {
    createResourceLimiter,
    authenticatedApiLimiter,
} = require('../../middleware/rateLimiter');
const {
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} = require('../../shared/errors');
const inboxRepository = require('./repository');
const { validateUid } = require('./validation');
const attachments = require('./operations/attachments');

const router = express.Router();
const config = getConfig();

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const dir = path.join(config.uploadPath, attachments.INBOX_DIR);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename(req, file, cb) {
        const suffix =
            Date.now() + '-' + crypto.randomBytes(12).toString('hex');
        // The extension comes from the known-types list, never from the
        // client's filename (GHSA-x24w-9w59-wqhq).
        cb(null, 'inbox-' + suffix + getExtensionFromMimeType(file.mimetype));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.fileUploadLimitMB * 1024 * 1024 },
});

// Multer's own errors (a file over the limit) would otherwise reach the
// global handler as a 500.
const singleFile = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            return next(
                new ValidationError(
                    error.code === 'LIMIT_FILE_SIZE'
                        ? `File size exceeds ${config.fileUploadLimitMB}MB limit`
                        : error.message
                )
            );
        }
        return next(error);
    });
};

// Inbox items are private to their owner, so owning the item is the whole
// check. This runs before multer so a refused request never writes a file.
const loadOwnItem = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) throw new UnauthorizedError('Authentication required');
        validateUid(req.params.uid);
        const item = await inboxRepository.findByUid(userId, req.params.uid);
        if (!item) throw new NotFoundError('Inbox item not found.');
        req.authUserId = userId;
        req.inboxItem = item;
        next();
    } catch (error) {
        next(error);
    }
};

router.get('/inbox/:uid/attachments', loadOwnItem, async (req, res, next) => {
    try {
        res.json(await attachments.listForItem(req.inboxItem));
    } catch (error) {
        next(error);
    }
});

router.post(
    '/inbox/:uid/attachments',
    createResourceLimiter,
    requireFeature('attachments'),
    loadOwnItem,
    singleFile,
    async (req, res, next) => {
        try {
            const attachment = await attachments.addToItem(
                req.authUserId,
                req.inboxItem,
                req.file
            );
            res.status(201).json(attachment);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/inbox/:uid/attachments/:attachmentUid/download',
    authenticatedApiLimiter,
    loadOwnItem,
    async (req, res, next) => {
        try {
            const attachment = await attachments.findOne(
                req.inboxItem,
                req.params.attachmentUid
            );
            res.download(
                path.join(config.uploadPath, attachment.file_path),
                attachment.original_filename
            );
        } catch (error) {
            next(error);
        }
    }
);

router.delete(
    '/inbox/:uid/attachments/:attachmentUid',
    createResourceLimiter,
    loadOwnItem,
    async (req, res, next) => {
        try {
            await attachments.removeFromItem(
                req.inboxItem,
                req.params.attachmentUid
            );
            res.json({ message: 'Attachment deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
