'use strict';

const { Task, User, Person, Notification } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const taskEventService = require('../tasks/taskEventService');
const { resolveAssigneeUser } = require('../tasks/operations/assignment');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');
const { logError } = require('../../services/logService');
const {
    NotFoundError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');
const commentsRepository = require('./repository');
const peopleRepository = require('../people/repository');

const MAX_BODY_LENGTH = 10000;

// Resolves mention uids to names server-side, so the composer can insert a
// plain `@Name ` (no id embedded in the text to keep it readable while
// typing) and every viewer still gets a reliable link back to that person.
async function resolveMentionedPeopleMap(uids) {
    if (uids.length === 0) return new Map();
    const people = await Person.findAll({
        where: { uid: uids },
        attributes: ['uid', 'name'],
        raw: true,
    });
    return new Map(people.map((p) => [p.uid, p.name]));
}

// The author's name is linked to their People profile, which is addressed
// by Person uid, not User uid - resolve each author's canonical self-person.
async function resolveAuthorPersonUidMap(userIds) {
    if (userIds.length === 0) return new Map();
    const selfPeople = await peopleRepository.findSelfPeopleByUserIds(
        Array.from(userIds)
    );
    return new Map(selfPeople.map((p) => [p.linked_user_id, p.uid]));
}

function serializeComment(
    comment,
    mentionedPeopleByUid = new Map(),
    authorPersonUidByUserId = new Map()
) {
    const mentionedPersonUids = comment.mentioned_person_uids || [];
    return {
        uid: comment.uid,
        task_id: comment.task_id,
        body: comment.body,
        mentioned_person_uids: mentionedPersonUids,
        mentioned_people: mentionedPersonUids
            .map((uid) => ({ uid, name: mentionedPeopleByUid.get(uid) }))
            .filter((p) => p.name),
        created_at: comment.created_at,
        deleted_at: comment.deleted_at || null,
        author: comment.Author
            ? {
                  uid: comment.Author.uid,
                  name: comment.Author.name,
                  email: comment.Author.email,
                  person_uid:
                      authorPersonUidByUserId.get(comment.Author.id) || null,
              }
            : null,
    };
}

async function requireTaskAccess(userId, taskUid) {
    const access = await permissionsService.getAccess(userId, 'task', taskUid);
    if (access === permissionsService.ACCESS.NONE) {
        throw new NotFoundError('Task not found');
    }
    const task = await Task.findOne({ where: { uid: taskUid } });
    if (!task) {
        throw new NotFoundError('Task not found');
    }
    return task;
}

async function listComments(userId, taskUid) {
    const task = await requireTaskAccess(userId, taskUid);
    const comments = await commentsRepository.listForTask(task.id);
    const allMentionedUids = [
        ...new Set(comments.flatMap((c) => c.mentioned_person_uids || [])),
    ];
    const allAuthorUserIds = [
        ...new Set(comments.map((c) => c.user_id).filter(Boolean)),
    ];
    const [mentionedPeopleByUid, authorPersonUidByUserId] = await Promise.all([
        resolveMentionedPeopleMap(allMentionedUids),
        resolveAuthorPersonUidMap(allAuthorUserIds),
    ]);
    return comments.map((comment) => ({
        ...serializeComment(
            comment,
            mentionedPeopleByUid,
            authorPersonUidByUserId
        ),
        is_own: comment.user_id === userId,
    }));
}

// Best-effort: a notification failure must never fail the comment write.
async function notifyAboutComment(task, comment, actingUserId) {
    try {
        const actor = await User.findByPk(actingUserId, {
            attributes: ['id', 'name', 'email'],
        });
        const actorLabel = actor?.name || actor?.email || 'Someone';
        const notified = new Set([actingUserId]);

        const mentionedPersonUids = comment.mentioned_person_uids || [];
        for (const personUid of mentionedPersonUids) {
            const mentionedUser = await resolveAssigneeUser(personUid);
            if (!mentionedUser || notified.has(mentionedUser.id)) continue;
            notified.add(mentionedUser.id);

            if (!shouldSendInAppNotification(mentionedUser, 'mention')) {
                continue;
            }
            const sources = shouldSendTelegramNotification(
                mentionedUser,
                'mention'
            )
                ? ['telegram']
                : [];

            await Notification.createNotification({
                userId: mentionedUser.id,
                type: 'mention',
                title: `${actorLabel} mentioned you`,
                message: `"${comment.body}" on "${task.name}"`,
                data: {
                    taskUid: task.uid,
                    taskName: task.name,
                    commentUid: comment.uid,
                },
                sources,
            });
        }

        const owner = await User.findByPk(task.user_id, {
            attributes: [
                'id',
                'name',
                'email',
                'notification_preferences',
                'telegram_bot_token',
                'telegram_chat_id',
            ],
        });
        const assignee = task.assigned_to
            ? await resolveAssigneeUser(task.assigned_to)
            : null;

        for (const recipient of [owner, assignee]) {
            if (!recipient || notified.has(recipient.id)) continue;
            notified.add(recipient.id);

            if (!shouldSendInAppNotification(recipient, 'comment_added')) {
                continue;
            }
            const sources = shouldSendTelegramNotification(
                recipient,
                'comment_added'
            )
                ? ['telegram']
                : [];

            await Notification.createNotification({
                userId: recipient.id,
                type: 'comment_added',
                title: `${actorLabel} commented on "${task.name}"`,
                message: comment.body,
                data: {
                    taskUid: task.uid,
                    taskName: task.name,
                    commentUid: comment.uid,
                },
                sources,
            });
        }
    } catch (error) {
        logError(error, `Failed to notify about comment ${comment?.uid}`);
    }
}

async function addComment(userId, taskUid, { body, mentionedPersonUids }) {
    const trimmed = (body || '').trim();
    if (!trimmed) {
        throw new ValidationError('Comment body is required');
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
        throw new ValidationError('Comment is too long');
    }

    // Reading access is enough to comment - a read-only collaborator can
    // still take part in the discussion.
    const task = await requireTaskAccess(userId, taskUid);

    const comment = await commentsRepository.createForTask(task.id, userId, {
        body: trimmed,
        mentionedPersonUids: Array.isArray(mentionedPersonUids)
            ? mentionedPersonUids.filter((v) => typeof v === 'string')
            : [],
    });

    await taskEventService.logEvent({
        taskId: task.id,
        userId,
        eventType: 'comment_added',
        metadata: { action: 'comment_added', commentUid: comment.uid },
    });

    await notifyAboutComment(task, comment, userId);

    comment.Author = await User.findByPk(userId, {
        attributes: ['id', 'uid', 'name', 'email'],
    });
    const [mentionedPeopleByUid, authorPersonUidByUserId] = await Promise.all([
        resolveMentionedPeopleMap(comment.mentioned_person_uids || []),
        resolveAuthorPersonUidMap([userId]),
    ]);
    return {
        ...serializeComment(
            comment,
            mentionedPeopleByUid,
            authorPersonUidByUserId
        ),
        is_own: true,
    };
}

// A delete is a tombstone, not a removal: the row (and its place in the
// thread) stays, but the content is gone for good - the body and mentions
// are cleared, and the client renders a "Comment deleted" placeholder in
// its spot (same idea as Signal/Viber), rather than the comment vanishing
// and shifting everything else around it.
async function removeComment(userId, commentUid) {
    const comment = await commentsRepository.findByUid(commentUid);
    if (!comment || comment.deleted_at) {
        throw new NotFoundError('Comment not found');
    }

    const task = await Task.findByPk(comment.task_id, {
        attributes: ['uid'],
    });
    const access = task
        ? await permissionsService.getAccess(userId, 'task', task.uid)
        : permissionsService.ACCESS.NONE;
    if (access === permissionsService.ACCESS.NONE) {
        throw new NotFoundError('Comment not found');
    }
    if (comment.user_id !== userId) {
        throw new ForbiddenError('Only the author can delete this comment');
    }

    await comment.update({
        body: '',
        mentioned_person_uids: [],
        deleted_at: new Date(),
    });

    const authorPersonUidByUserId = await resolveAuthorPersonUidMap([userId]);
    return {
        ...serializeComment(comment, new Map(), authorPersonUidByUserId),
        is_own: true,
    };
}

module.exports = { listComments, addComment, removeComment };
