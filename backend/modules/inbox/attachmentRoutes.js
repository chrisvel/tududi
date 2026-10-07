'use strict';

const {
    createAttachmentRouter,
    inboxAttachments,
} = require('../../services/entityAttachments');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { NotFoundError, UnauthorizedError } = require('../../shared/errors');
const inboxRepository = require('./repository');
const { validateUid } = require('./validation');

// Inbox items are private to their owner, so owning the item is the whole
// check, for reading and for writing.
const loadOwnItem = async (req) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    validateUid(req.params.uid);
    const item = await inboxRepository.findByUid(userId, req.params.uid);
    if (!item) throw new NotFoundError('Inbox item not found.');
    return item;
};

const allowOwner = (req, res, next) => next();

module.exports = createAttachmentRouter({
    basePath: '/inbox/:uid/attachments',
    store: inboxAttachments,
    canRead: allowOwner,
    canWrite: allowOwner,
    loadOwner: loadOwnItem,
});
