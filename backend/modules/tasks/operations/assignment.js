'use strict';

const { Op } = require('sequelize');
const { Person, User, Notification } = require('../../../models');
const {
    shouldSendInAppNotification,
    deliverySources,
} = require('../../../utils/notificationPreferences');
const { logError } = require('../../../services/logService');

// Resolve a people.uid to the user account it is linked to, if any.
async function resolveAssigneeUser(personUid) {
    if (!personUid) return null;
    const person = await Person.findOne({
        where: { uid: personUid },
        attributes: ['linked_user_id'],
        raw: true,
    });
    if (!person || !person.linked_user_id) return null;
    return User.findByPk(person.linked_user_id, {
        attributes: [
            'id',
            'email',
            'name',
            'notification_preferences',
            'telegram_bot_token',
            'telegram_chat_id',
        ],
    });
}

// Assignments from the same person this close together share one
// notification, so setting up a project or importing a sheet does not bury
// the assignee in dozens of them.
const ASSIGNMENT_BATCH_WINDOW_MS = 10 * 60 * 1000;

function assignedTitle(actorLabel, count) {
    return count > 1
        ? `${actorLabel} assigned you ${count} tasks`
        : `${actorLabel} assigned you a task`;
}

function assignedMessage(taskName, count) {
    if (count <= 1) return `"${taskName}" was assigned to you.`;
    const others = count - 1;
    return `"${taskName}" and ${others} more ${
        others === 1 ? 'task' : 'tasks'
    } were assigned to you.`;
}

// The assignee's unread assignment notice from the same assigner, still
// inside the batch window, if there is one.
async function findOpenBatch(assigneeId, actingUserId) {
    const candidates = await Notification.findAll({
        where: {
            user_id: assigneeId,
            type: 'task_assigned',
            read_at: null,
            dismissed_at: null,
            created_at: {
                [Op.gte]: new Date(Date.now() - ASSIGNMENT_BATCH_WINDOW_MS),
            },
        },
        order: [['created_at', 'DESC']],
    });
    return (
        candidates.find(
            (n) => n.data && n.data.assignedByUserId === actingUserId
        ) || null
    );
}

// Fold one more assignment into an open batch. Only the in-app notice
// changes; email, push and Telegram went out with the first one. Webhooks
// still get one task.assigned event per task.
async function addToBatch(notification, task, actorLabel, data) {
    const previous = notification.data || {};
    const taskUids = Array.isArray(previous.taskUids)
        ? [...previous.taskUids]
        : [previous.taskUid].filter(Boolean);
    if (!taskUids.includes(task.uid)) taskUids.push(task.uid);
    const count = taskUids.length;

    notification.title = assignedTitle(actorLabel, count);
    notification.message = assignedMessage(task.name, count);
    notification.data = { ...data, taskUids, count };
    notification.changed('data', true);
    await notification.save();

    await Notification.emitWebhook(notification, {
        title: assignedTitle(actorLabel, 1),
        message: assignedMessage(task.name, 1),
        data,
    });
}

// Notify the person a task was just assigned to, when they have an account and
// aren't the one doing the assigning. Best-effort: a failure here never fails
// the task write.
async function notifyAssignee(task, previousAssignedTo, actingUserId) {
    try {
        const newAssignedTo = task.assigned_to || null;
        if (!newAssignedTo || newAssignedTo === previousAssignedTo) return;

        const assignee = await resolveAssigneeUser(newAssignedTo);
        if (!assignee || assignee.id === actingUserId) return;

        if (!shouldSendInAppNotification(assignee, 'task_assigned')) return;

        const actor = await User.findByPk(actingUserId, {
            attributes: ['id', 'name', 'email'],
        });
        const actorLabel = actor?.name || actor?.email || 'Someone';

        const data = {
            taskUid: task.uid,
            taskName: task.name,
            assignedByUserId: actingUserId,
            projectUid: task.Project ? task.Project.uid : null,
        };

        const batch = await findOpenBatch(assignee.id, actingUserId);
        if (batch) {
            await addToBatch(batch, task, actorLabel, data);
            return;
        }

        const sources = deliverySources(assignee, 'task_assigned');

        await Notification.createNotification({
            userId: assignee.id,
            type: 'task_assigned',
            title: assignedTitle(actorLabel, 1),
            message: assignedMessage(task.name, 1),
            data: { ...data, taskUids: [task.uid], count: 1 },
            sources,
        });
    } catch (error) {
        logError(error, `Failed to notify assignee for task ${task?.uid}`);
    }
}

module.exports = {
    notifyAssignee,
    resolveAssigneeUser,
    ASSIGNMENT_BATCH_WINDOW_MS,
};
