'use strict';

// Files attached to inbox items, tasks, projects and notes. Each kind has
// its own table and upload folder; this module holds what they share:
// storing, listing, removing and moving files, the upload middleware and a
// router with the four attachment endpoints.

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getConfig } = require('../config/config');
const {
    getExtensionFromMimeType,
    deleteFileFromDisk,
} = require('../utils/attachment-utils');
const entitlements = require('./entitlementsService');
const { logError } = require('./logService');
const { NotFoundError, ValidationError } = require('../shared/errors');
const { requireFeature } = require('../middleware/entitlements');
const {
    createResourceLimiter,
    authenticatedApiLimiter,
} = require('../middleware/rateLimiter');

const MAX_ATTACHMENTS = 20;

const uploadPath = () => getConfig().uploadPath;

// Required lazily: the models module is loaded after the services that
// import this file.
const models = () => require('../models');

function createAttachmentStore({ model, ownerKey, dir, prefix }) {
    const Model = () => models()[model];

    const serialize = (attachment) => ({
        uid: attachment.uid,
        original_filename: attachment.original_filename,
        stored_filename: attachment.stored_filename,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        file_url: `/api/uploads/${dir}/${attachment.stored_filename}`,
        created_at: attachment.created_at,
        updated_at: attachment.updated_at,
    });

    const findAll = (ownerId) =>
        Model().findAll({
            where: { [ownerKey]: ownerId },
            order: [['created_at', 'ASC']],
        });

    const store = {
        dir,
        prefix,
        serialize,

        async list(ownerId) {
            return (await findAll(ownerId)).map(serialize);
        },

        // Attachments for many owners in one query, keyed by owner id.
        async listMany(ownerIds) {
            const byOwner = new Map();
            if (ownerIds.length === 0) return byOwner;
            const rows = await Model().findAll({
                where: { [ownerKey]: ownerIds },
                order: [['created_at', 'ASC']],
            });
            for (const row of rows) {
                const list = byOwner.get(row[ownerKey]) || [];
                list.push(serialize(row));
                byOwner.set(row[ownerKey], list);
            }
            return byOwner;
        },

        count(ownerId) {
            return Model().count({ where: { [ownerKey]: ownerId } });
        },

        // The file is already on disk (multer wrote it). Any refusal here
        // removes it again, so a rejected upload leaves nothing behind.
        async add(userId, ownerId, file) {
            if (!file) {
                throw new ValidationError('No file uploaded');
            }
            try {
                if ((await store.count(ownerId)) >= MAX_ATTACHMENTS) {
                    throw new ValidationError(
                        `Maximum ${MAX_ATTACHMENTS} attachments allowed`
                    );
                }
                await entitlements.assertStorage(userId, file.size);
                const attachment = await Model().create({
                    [ownerKey]: ownerId,
                    user_id: userId,
                    original_filename: file.originalname,
                    stored_filename: file.filename,
                    file_size: file.size,
                    mime_type: file.mimetype,
                    file_path: `${dir}/${file.filename}`,
                });
                return serialize(attachment);
            } catch (error) {
                await deleteFileFromDisk(file.path);
                throw error;
            }
        },

        async findOne(ownerId, attachmentUid) {
            const attachment = await Model().findOne({
                where: { [ownerKey]: ownerId, uid: attachmentUid },
            });
            if (!attachment) {
                throw new NotFoundError('Attachment not found');
            }
            return attachment;
        },

        async remove(ownerId, attachmentUid) {
            const attachment = await store.findOne(ownerId, attachmentUid);
            await deleteFileFromDisk(
                path.join(uploadPath(), attachment.file_path)
            );
            await attachment.destroy();
        },

        async removeAll(ownerId, options = {}) {
            const rows = await Model().findAll({
                where: { [ownerKey]: ownerId },
                ...options,
            });
            for (const row of rows) {
                await deleteFileFromDisk(
                    path.join(uploadPath(), row.file_path)
                );
            }
            await Model().destroy({
                where: { [ownerKey]: ownerId },
                ...options,
            });
        },

        // Moves every file to another owner, which may be of another kind
        // (an inbox item's files onto the task it became). Files the target
        // has no room for stay where they are rather than being thrown away.
        async moveAll(fromOwnerId, target, targetOwnerId) {
            const rows = await findAll(fromOwnerId);
            if (rows.length === 0) return [];

            const targetDir = path.join(uploadPath(), target.dir);
            await fs.promises.mkdir(targetDir, { recursive: true });
            let room = MAX_ATTACHMENTS - (await target.count(targetOwnerId));
            const moved = [];

            for (const row of rows) {
                if (room <= 0) break;
                const from = path.join(uploadPath(), row.file_path);
                const to = path.join(targetDir, row.stored_filename);
                try {
                    await fs.promises.rename(from, to);
                } catch (error) {
                    logError('Could not move attachment file:', error);
                    continue;
                }
                try {
                    const created = await models().sequelize.transaction(
                        async (transaction) => {
                            const copy = await target.createRow(
                                {
                                    ownerId: targetOwnerId,
                                    user_id: row.user_id,
                                    original_filename: row.original_filename,
                                    stored_filename: row.stored_filename,
                                    file_size: row.file_size,
                                    mime_type: row.mime_type,
                                },
                                transaction
                            );
                            await row.destroy({ transaction });
                            return copy;
                        }
                    );
                    moved.push(target.serialize(created));
                } catch (error) {
                    await fs.promises.rename(to, from).catch(() => {});
                    throw error;
                }
                room -= 1;
            }
            return moved;
        },

        createRow(data, transaction) {
            const { ownerId, ...rest } = data;
            return Model().create(
                {
                    ...rest,
                    [ownerKey]: ownerId,
                    file_path: `${dir}/${rest.stored_filename}`,
                },
                { transaction }
            );
        },
    };

    return store;
}

const inboxAttachments = createAttachmentStore({
    model: 'InboxItemAttachment',
    ownerKey: 'inbox_item_id',
    dir: 'inbox',
    prefix: 'inbox',
});

const taskAttachments = createAttachmentStore({
    model: 'TaskAttachment',
    ownerKey: 'task_id',
    dir: 'tasks',
    prefix: 'task',
});

const projectAttachments = createAttachmentStore({
    model: 'ProjectAttachment',
    ownerKey: 'project_id',
    dir: 'project-files',
    prefix: 'project',
});

const noteAttachments = createAttachmentStore({
    model: 'NoteAttachment',
    ownerKey: 'note_id',
    dir: 'note-files',
    prefix: 'note',
});

// Multer for one store. The stored extension comes from the known-types
// list, never from the client's filename (GHSA-x24w-9w59-wqhq), and multer's
// own errors (a file over the limit) become a 400 instead of a 500.
function uploadSingleFile(store) {
    const config = getConfig();
    const upload = multer({
        storage: multer.diskStorage({
            destination(req, file, cb) {
                const dir = path.join(config.uploadPath, store.dir);
                fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename(req, file, cb) {
                const suffix =
                    Date.now() + '-' + crypto.randomBytes(12).toString('hex');
                cb(
                    null,
                    `${store.prefix}-${suffix}${getExtensionFromMimeType(file.mimetype)}`
                );
            },
        }),
        limits: { fileSize: config.fileUploadLimitMB * 1024 * 1024 },
    });

    return (req, res, next) => {
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
}

// GET/POST `${basePath}`, DELETE `${basePath}/:attachmentUid` and
// GET `${basePath}/:attachmentUid/download`. `canRead` and `canWrite` are
// access checks; `loadOwner` puts the owning row on req.attachmentOwner. All
// of them run before multer, so a refused upload never writes a file.
function createAttachmentRouter({
    basePath,
    store,
    canRead,
    canWrite,
    loadOwner,
}) {
    const router = express.Router();
    const upload = uploadSingleFile(store);
    const owner = async (req, res, next) => {
        try {
            req.attachmentOwner = await loadOwner(req);
            if (!req.attachmentOwner) throw new NotFoundError('Not found');
            next();
        } catch (error) {
            next(error);
        }
    };
    const handle = (fn) => async (req, res, next) => {
        try {
            await fn(req, res);
        } catch (error) {
            next(error);
        }
    };
    const userId = (req) => req.currentUser?.id || req.session?.userId;

    router.get(
        basePath,
        canRead,
        owner,
        handle(async (req, res) => {
            res.json(await store.list(req.attachmentOwner.id));
        })
    );

    router.post(
        basePath,
        createResourceLimiter,
        requireFeature('attachments'),
        canWrite,
        owner,
        upload,
        handle(async (req, res) => {
            res.status(201).json(
                await store.add(userId(req), req.attachmentOwner.id, req.file)
            );
        })
    );

    router.get(
        `${basePath}/:attachmentUid/download`,
        authenticatedApiLimiter,
        canRead,
        owner,
        handle(async (req, res) => {
            const attachment = await store.findOne(
                req.attachmentOwner.id,
                req.params.attachmentUid
            );
            res.download(
                path.join(uploadPath(), attachment.file_path),
                attachment.original_filename
            );
        })
    );

    router.delete(
        `${basePath}/:attachmentUid`,
        createResourceLimiter,
        canWrite,
        owner,
        handle(async (req, res) => {
            await store.remove(
                req.attachmentOwner.id,
                req.params.attachmentUid
            );
            res.json({ message: 'Attachment deleted successfully' });
        })
    );

    return router;
}

module.exports = {
    MAX_ATTACHMENTS,
    createAttachmentStore,
    createAttachmentRouter,
    inboxAttachments,
    taskAttachments,
    projectAttachments,
    noteAttachments,
};
