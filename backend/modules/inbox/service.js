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
const peopleService = require('../people/service');
const attachments = require('./operations/attachments');

// Items go out as plain objects with their files under `attachments`.
async function withAttachments(items) {
    const byItem = await attachments.listForItems(items);
    return items.map((item) => ({
        ...item.toJSON(),
        attachments: byItem.get(item.id) || [],
    }));
}

class InboxService {
    async getAll(userId, { limit, offset } = {}) {
        const hasPagination = limit !== undefined || offset !== undefined;

        if (hasPagination) {
            const parsedLimit = parseInt(limit, 10) || 20;
            const parsedOffset = parseInt(offset, 10) || 0;

            const [rows, totalCount, trashedCount] = await Promise.all([
                inboxRepository.findAllActive(userId, {
                    limit: parsedLimit,
                    offset: parsedOffset,
                }),
                inboxRepository.countActive(userId),
                inboxRepository.countTrashed(userId),
            ]);
            const items = await withAttachments(rows);

            return {
                items,
                pagination: {
                    total: totalCount,
                    limit: parsedLimit,
                    offset: parsedOffset,
                    hasMore: parsedOffset + rows.length < totalCount,
                },
                trashedCount,
            };
        }

        return withAttachments(await inboxRepository.findAllActive(userId));
    }

    async getByUid(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        return {
            ..._.pick(item, PUBLIC_ATTRIBUTES),
            attachments: await attachments.listForItem(item),
        };
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

        return { ..._.pick(item, PUBLIC_ATTRIBUTES), attachments: [] };
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

        return {
            ..._.pick(item, PUBLIC_ATTRIBUTES),
            attachments: await attachments.listForItem(item),
        };
    }

    async delete(userId, uid) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        // A deleted item cannot come back, so its files go now.
        await attachments.removeAllFromItem(item);
        await inboxRepository.softDelete(item);

        return { message: 'Inbox item successfully deleted' };
    }

    // With a task uid, the item became that task and its files move there.
    async process(userId, uid, { taskUid } = {}) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        if (taskUid) {
            validateUid(taskUid);
            const task = await attachments.findWritableTask(userId, taskUid);
            await attachments.moveToTask(item, task);
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

    async restoreAll(userId) {
        await inboxRepository.restoreAllTrashed(userId);
        return { message: 'All trashed items restored' };
    }

    async analyzeText(
        userId,
        content,
        { referenceDate, timezone, parseDates = true } = {}
    ) {
        validateContent(content);
        const options = { referenceDate, timezone, parseDates };
        const result = processInboxItem(content, options);

        const assignee = result.parsed_person
            ? await this.resolveAssignee(
                  userId,
                  result.parsed_person,
                  result.parsed_projects[0]
              )
            : null;
        if (!assignee) {
            return { ...result, parsed_assignee: null };
        }

        return {
            ...processInboxItem(content, { ...options, personResolved: true }),
            parsed_assignee: assignee,
        };
    }

    // Match an @name against the people the task could be assigned to: the
    // project's list when a +project resolves, the workspace list otherwise.
    // A full name wins; a first name only counts when it is unambiguous.
    async resolveAssignee(userId, name, projectName) {
        const projectUid = projectName
            ? await inboxRepository.findAccessibleProjectUidByName(
                  userId,
                  projectName
              )
            : null;
        const people = projectUid
            ? await peopleService.getAssignableForProject(userId, projectUid)
            : await peopleService.getAssignable(userId);

        const wanted = name.toLowerCase();
        const exact = people.filter(
            (person) => person.name?.trim().toLowerCase() === wanted
        );
        const byFirstName = people.filter(
            (person) =>
                person.name?.trim().split(/\s+/)[0].toLowerCase() === wanted
        );
        const match =
            exact.length === 1
                ? exact[0]
                : byFirstName.length === 1
                  ? byFirstName[0]
                  : null;

        return match ? { uid: match.uid, name: match.name } : null;
    }
}

module.exports = new InboxService();
