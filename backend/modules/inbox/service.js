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
    /**
     * Get all active inbox items for a user.
     * Supports pagination if limit/offset provided.
     */
    async getAll(userId, { limit, offset } = {}) {
        const hasPagination = limit !== undefined || offset !== undefined;

        if (hasPagination) {
            const parsedLimit = parseInt(limit, 10) || 20;
            const parsedOffset = parseInt(offset, 10) || 0;

            const [items, totalCount] = await Promise.all([
                inboxRepository.findAllActive(userId, {
                    limit: parsedLimit,
                    offset: parsedOffset,
                }),
                inboxRepository.countActive(userId),
            ]);

            return {
                items,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    offset: parsedOffset,
                    hasMore: parsedOffset + items.length < totalCount,
                },
            };
        }

        // Return simple array for backward compatibility
        return inboxRepository.findAllActive(userId);
    }

    /**
     * Get a single inbox item by UID.
     */
    async getByUid(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUidPublic(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        return item;
    }

    /**
     * Create a new inbox item.
     */
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

    /**
     * Update an inbox item.
     */
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

    /**
     * Soft delete an inbox item.
     */
    async delete(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.softDelete(item);

        return { message: 'Inbox item successfully deleted' };
    }

    /**
     * Mark an inbox item as processed.
     */
    async process(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        await inboxRepository.markProcessed(item);

        return _.pick(item, PUBLIC_ATTRIBUTES);
    }

    /**
     * Analyze text content without creating an inbox item.
     */
    analyzeText(content) {
        validateContent(content);
        return processInboxItem(content);
    }
}

module.exports = new InboxService();
