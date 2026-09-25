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
