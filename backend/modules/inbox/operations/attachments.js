'use strict';

const { Task, Project, Note } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const {
    inboxAttachments,
    taskAttachments,
    projectAttachments,
    noteAttachments,
} = require('../../../services/entityAttachments');
const { noteLinksFor } = require('../../notes/attachmentLinks');
const { ForbiddenError, NotFoundError } = require('../../../shared/errors');

// What an inbox item can become when it is processed, and where its files
// go then.
const TARGETS = {
    task: { Model: Task, store: taskAttachments },
    project: { Model: Project, store: projectAttachments },
    note: { Model: Note, store: noteAttachments },
};

// Checked before the item is marked processed, so a bad uid leaves the item
// and its files where they were.
async function findWritableTarget(userId, kind, uid) {
    const { Model } = TARGETS[kind];
    const row = await Model.findOne({ where: { uid } });
    if (!row) {
        throw new NotFoundError(
            `${kind[0].toUpperCase()}${kind.slice(1)} not found`
        );
    }
    const access = await permissionsService.getAccess(userId, kind, uid);
    if (access !== 'rw' && access !== 'admin') {
        throw new ForbiddenError(`Not authorized to modify this ${kind}`);
    }
    return row;
}

// Moves the item's files onto what it became. A note also gets them in its
// text, as inline images or links, since a note shows files by linking them.
async function moveToTarget(item, kind, row) {
    const moved = await inboxAttachments.moveAll(
        item.id,
        TARGETS[kind].store,
        row.id
    );
    if (kind === 'note' && moved.length > 0) {
        const links = noteLinksFor(row.uid, moved);
        const content = row.content ? `${row.content}\n\n${links}` : links;
        await row.update({ content });
    }
    return moved;
}

module.exports = {
    TARGETS,
    listForItem: (item) => inboxAttachments.list(item.id),
    listForItems: (items) => inboxAttachments.listMany(items.map((i) => i.id)),
    removeAllFromItem: (item) => inboxAttachments.removeAll(item.id),
    findWritableTarget,
    moveToTarget,
};
