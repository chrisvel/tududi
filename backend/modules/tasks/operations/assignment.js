'use strict';

const { Person, User, Notification } = require('../../../models');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
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

        const sources = [];
        if (shouldSendTelegramNotification(assignee, 'task_assigned')) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: assignee.id,
            type: 'task_assigned',
            title: `${actorLabel} assigned you a task`,
            message: `"${task.name}" was assigned to you.`,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                assignedByUserId: actingUserId,
                projectUid: task.Project ? task.Project.uid : null,
            },
            sources,
        });
    } catch (error) {
        logError(error, `Failed to notify assignee for task ${task?.uid}`);
    }
}

module.exports = { notifyAssignee, resolveAssigneeUser };
