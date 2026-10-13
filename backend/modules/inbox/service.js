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
const { processInboxItem, parseAreaRefs } = require('./inboxProcessingService');
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

            const [rows, totalCount] = await Promise.all([
                inboxRepository.findAllActive(userId, {
                    limit: parsedLimit,
                    offset: parsedOffset,
                }),
                inboxRepository.countActive(userId),
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

    // With the uid of the task, project or note the item became, its files
    // move there.
    async process(userId, uid, { target } = {}) {
        validateUid(uid);

        const item = await inboxRepository.findByUid(userId, uid);

        if (!item) {
            throw new NotFoundError('Inbox item not found.');
        }

        if (target) {
            validateUid(target.uid);
            const row = await attachments.findWritableTarget(
                userId,
                target.kind,
                target.uid
            );
            await attachments.moveToTarget(item, target.kind, row);
        }

        await inboxRepository.markProcessed(item);

        return _.pick(item, PUBLIC_ATTRIBUTES);
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
        const area = await this.resolveArea(userId, content);
        if (!assignee && !area) {
            return { ...result, parsed_assignee: null, parsed_area: null };
        }

        const resolved = processInboxItem(content, {
            ...options,
            personResolved: Boolean(assignee),
            areaName: area ? area.name : null,
        });
        return { ...resolved, parsed_assignee: assignee, parsed_area: area };
    }

    // The first ~area in the text that names an area the user can add
    // tasks to. With none, the first ~Name that starts with a letter is an
    // area to create when the item is saved (uid null), the way an unknown
    // #tag or +project is. A ~5 or ~$ stays plain text.
    async resolveArea(userId, content) {
        const refs = parseAreaRefs(content);
        for (const ref of refs) {
            const area = await inboxRepository.findWritableAreaByName(
                userId,
                ref.name
            );
            if (area) return { uid: area.uid, name: ref.name };
        }
        const fresh = refs.find((ref) => /^\p{L}/u.test(ref.name));
        return fresh ? { uid: null, name: fresh.name } : null;
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
