'use strict';

// Every event a webhook can subscribe to. The names are part of the public
// contract (receivers switch on them), so add new ones rather than rename.
const NOTIFICATION_EVENTS = [
    'task.due_soon',
    'task.overdue',
    'task.reminder',
    'task.deferred_ready',
    'task.assigned',
    'project.due_soon',
    'project.overdue',
    'habit.reminder',
    'comment.added',
    'comment.mention',
    'share.invitation',
];

const TASK_EVENTS = [
    'task.created',
    'task.updated',
    'task.completed',
    'task.deleted',
];

const SUMMARY_EVENTS = ['daily_summary'];

const ALL_EVENTS = [...NOTIFICATION_EVENTS, ...TASK_EVENTS, ...SUMMARY_EVENTS];

// The webhook event for an in-app notification, or null for notifications
// that are not sent out (billing and other system messages).
function eventForNotification(notification) {
    const reason = notification?.data?.reason;
    switch (notification?.type) {
        case 'task_due_soon':
            return reason === 'defer_until_reached'
                ? 'task.deferred_ready'
                : 'task.due_soon';
        case 'task_overdue':
            return 'task.overdue';
        case 'task_assigned':
            return 'task.assigned';
        case 'project_due_soon':
            return 'project.due_soon';
        case 'project_overdue':
            return 'project.overdue';
        case 'comment_added':
            return 'comment.added';
        case 'mention':
            return 'comment.mention';
        case 'share_invitation':
            return 'share.invitation';
        case 'reminder':
            if (reason === 'task_reminder') return 'task.reminder';
            if (reason === 'habit_reminder') return 'habit.reminder';
            return null;
        default:
            return null;
    }
}

module.exports = {
    NOTIFICATION_EVENTS,
    TASK_EVENTS,
    SUMMARY_EVENTS,
    ALL_EVENTS,
    eventForNotification,
};
