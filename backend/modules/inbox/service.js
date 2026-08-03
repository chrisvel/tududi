'use strict';

const _ = require('lodash');
const inboxRepository = require('./repository');
const { PUBLIC_ATTRIBUTES } = require('./repository');
const {
    validateContent,
    validateUid,
    validateSource,
    buildTitleFromContent,
} = require('./validation');
const { NotFoundError } = require('../../shared/errors');
const { processInboxItem } = require('./inboxProcessingService');

class InboxService {
    async getAll(userId, { limit, offset } = {}) {
        const hasPagination = limit !== undefined || offset !== undefined;

        if (hasPagination) {
            const parsedLimit = parseInt(limit, 10) || 20;
            const parsedOffset = parseInt(offset, 10) || 0;

            const [items, totalCount, trashedCount] = await Promise.all([
                inboxRepository.findAllActive(userId, {
                    limit: parsedLimit,
                    offset: parsedOffset,
                }),
                inboxRepository.countActive(userId),
                inboxRepository.countTrashed(userId),
            ]);

            return {
                items,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    offset: parsedOffset,
                    hasMore: parsedOffset + items.length < totalCount,
                },
                trashedCount,
            };
        }

        return inboxRepository.findAllActive(userId);
    }

    async getByUid(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUidPublic(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        return item;
    }

    async create(userId, { content, source }) {
        const validatedContent = validateContent(content);
        const validatedSource = validateSource(source);
        const title = buildTitleFromContent(validatedContent);

        const item = await inboxRepository.createForUser(userId, {
            content: validatedContent,
            title,
            source: validatedSource,
        });

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    async update(userId, uid, { content, status }) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        const updateData = {};

        if (content !== undefined && content !== null) {
            const validatedContent = validateContent(content);
            updateData.content = validatedContent;
            updateData.title = buildTitleFromContent(validatedContent);
        }

        if (status !== undefined && status !== null) {
            updateData.status = status;
        }

        await inboxRepository.updateItem(item, updateData);

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    async delete(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.softDelete(item);

        return { message: 'Inbox item successfully deleted' };
    }

    async process(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.markProcessed(item);

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    async trash(userId, uid) {
        validateUid(uid);
        const item = await inboxRepository.findByUid(userId, uid);
        if (!item) throw new NotFoundError('Inbox item not found.');
        await inboxRepository.markTrashed(item);
        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    async restore(userId, uid) {
        validateUid(uid);
        const item = await inboxRepository.findByUid(userId, uid);
        if (!item) throw new NotFoundError('Inbox item not found.');
        await inboxRepository.markRestored(item);
        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    analyzeText(content) {
        validateContent(content);
        return processInboxItem(content);
    }
}

module.exports = new InboxService();
