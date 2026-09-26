'use strict';

const path = require('path');
const fs = require('fs').promises;
const { getConfig } = require('../../../config/config');
const { Task } = require('../../../models');
const attachmentsRepository = require('../attachmentsRepository');
const permissionsService = require('../../../services/permissionsService');
const entitlements = require('../../../services/entitlementsService');
const { deleteFileFromDisk } = require('../../../utils/attachment-utils');
const { logError } = require('../../../services/logService');
const {
    ForbiddenError,
    NotFoundError,
    ValidationError,
} = require('../../../shared/errors');

// Same cap as a task, so moving an item's files onto a new task always fits.
const MAX_ATTACHMENTS_PER_ITEM = 20;
const MAX_ATTACHMENTS_PER_TASK = 20;
const INBOX_DIR = 'inbox';
const TASKS_DIR = 'tasks';

const uploadPath = () => getConfig().uploadPath;

function serializeAttachment(attachment) {
    return {
        uid: attachment.uid,
        original_filename: attachment.original_filename,
        stored_filename: attachment.stored_filename,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        file_url: `/api/uploads/${INBOX_DIR}/${attachment.stored_filename}`,
        created_at: attachment.created_at,
        updated_at: attachment.updated_at,
    };
}

async function listForItem(item) {
    const attachments = await attachmentsRepository.findForItem(item.id);
    return attachments.map(serializeAttachment);
}

// Attachments for a page of items, keyed by item id, in one query.
async function listForItems(items) {
    const attachments = await attachmentsRepository.findForItems(
        items.map((item) => item.id)
    );
    const byItem = new Map();
    for (const attachment of attachments) {
        const list = byItem.get(attachment.inbox_item_id) || [];
        list.push(serializeAttachment(attachment));
        byItem.set(attachment.inbox_item_id, list);
    }
    return byItem;
}

// The file is already on disk (multer wrote it). Any refusal here removes it
// again, so a rejected upload leaves nothing behind.
async function addToItem(userId, item, file) {
    if (!file) {
        throw new ValidationError('No file uploaded');
    }
    try {
        const count = await attachmentsRepository.countForItem(item.id);
        if (count >= MAX_ATTACHMENTS_PER_ITEM) {
            throw new ValidationError(
                `Maximum ${MAX_ATTACHMENTS_PER_ITEM} attachments allowed per inbox item`
            );
        }
        await entitlements.assertStorage(userId, file.size);
        const attachment = await attachmentsRepository.create({
            inbox_item_id: item.id,
            user_id: userId,
            original_filename: file.originalname,
            stored_filename: file.filename,
            file_size: file.size,
            mime_type: file.mimetype,
            file_path: `${INBOX_DIR}/${file.filename}`,
        });
        return serializeAttachment(attachment);
    } catch (error) {
        await deleteFileFromDisk(file.path);
        throw error;
    }
}

async function findOne(item, attachmentUid) {
    const attachment = await attachmentsRepository.findOneForItem(
        item.id,
        attachmentUid
    );
    if (!attachment) {
        throw new NotFoundError('Attachment not found');
    }
    return attachment;
}

async function removeFromItem(item, attachmentUid) {
    const attachment = await findOne(item, attachmentUid);
    await deleteFileFromDisk(path.join(uploadPath(), attachment.file_path));
    await attachment.destroy();
}

async function removeAllFromItem(item) {
    const attachments = await attachmentsRepository.findForItem(item.id);
    for (const attachment of attachments) {
        await deleteFileFromDisk(path.join(uploadPath(), attachment.file_path));
    }
    await attachmentsRepository.destroyForItem(item.id);
}

// Checked before the item is marked processed, so a bad task uid leaves the
// item and its files where they were.
async function findWritableTask(userId, taskUid) {
    const task = await Task.findOne({ where: { uid: taskUid } });
    if (!task) {
        throw new NotFoundError('Task not found');
    }
    const access = await permissionsService.getAccess(userId, 'task', taskUid);
    if (access !== 'rw' && access !== 'admin') {
        throw new ForbiddenError('Not authorized to modify this task');
    }
    return task;
}

// When an item becomes a task its files go with it. Files the task has no
// room for stay on the (processed) item rather than being thrown away.
async function moveToTask(item, task) {
    const attachments = await attachmentsRepository.findForItem(item.id);
    if (attachments.length === 0) return 0;

    const tasksDir = path.join(uploadPath(), TASKS_DIR);
    await fs.mkdir(tasksDir, { recursive: true });

    let room =
        MAX_ATTACHMENTS_PER_TASK -
        (await attachmentsRepository.countForTask(task.id));
    let moved = 0;
    for (const attachment of attachments) {
        if (room <= 0) break;
        const from = path.join(uploadPath(), attachment.file_path);
        const to = path.join(tasksDir, attachment.stored_filename);
        try {
            await fs.rename(from, to);
        } catch (error) {
            logError('Could not move inbox attachment to task:', error);
            continue;
        }
        try {
            await attachmentsRepository.moveToTask(
                attachment,
                task.id,
                `${TASKS_DIR}/${attachment.stored_filename}`
            );
        } catch (error) {
            await fs.rename(to, from).catch(() => {});
            throw error;
        }
        room -= 1;
        moved += 1;
    }
    return moved;
}

module.exports = {
    INBOX_DIR,
    listForItem,
    listForItems,
    addToItem,
    findOne,
    removeFromItem,
    removeAllFromItem,
    findWritableTask,
    moveToTask,
    serializeAttachment,
};
