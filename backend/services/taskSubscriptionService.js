const { Task, User, Permission, Notification } = require('../models');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../utils/notificationPreferences');

/**
 * Subscribe a user to a task
 * Creates permission and adds user to subscribers
 *
 * @param {number} taskId - Task ID to subscribe to
 * @param {number} subscriberUserId - User ID to subscribe
 * @param {number} subscribedByUserId - User ID performing the subscription
 * @returns {Promise<Task>} - Updated task with Subscribers
 */
async function subscribeToTask(taskId, subscriberUserId, subscribedByUserId) {
    try {
        // Load task with owner and subscribers
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: [] },
                },
            ],
        });

        if (!task) {
            throw new Error('Task not found');
        }

        // Load subscriber user
        const subscriber = await User.findByPk(subscriberUserId, {
            attributes: [
                'id',
                'uid',
                'email',
                'name',
                'surname',
                'avatar_image',
                'notification_preferences',
            ],
        });

        if (!subscriber) {
            throw new Error('User not found');
        }

        // Check if user is already subscribed
        const isAlreadySubscribed = task.Subscribers.some(
            (sub) => sub.id === subscriberUserId
        );

        if (isAlreadySubscribed) {
            throw new Error('User already subscribed');
        }

        // Add subscriber
        await task.addSubscriber(subscriber);

        // Create permission record with propagation: 'subscription'
        await Permission.create({
            user_id: subscriberUserId,
            resource_type: 'task',
            resource_uid: task.uid,
            access_level: 'rw', // Subscribers have read-write access
            propagation: 'subscription',
            granted_by_user_id: subscribedByUserId,
        });

        // Reload task with updated subscribers
        await task.reload({
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: [] },
                },
            ],
        });

        return task;
    } catch (error) {
        logError('Error subscribing to task:', error);
        throw error;
    }
}

/**
 * Unsubscribe a user from a task
 * Removes permission and removes user from subscribers
 *
 * @param {number} taskId - Task ID to unsubscribe from
 * @param {number} subscriberUserId - User ID to unsubscribe
 * @param {number} unsubscribedByUserId - User ID performing the unsubscription
 * @returns {Promise<Task>} - Updated task
 */
async function unsubscribeFromTask(
    taskId,
    subscriberUserId,
    unsubscribedByUserId
) {
    try {
        // Load task with subscribers
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: [] },
                },
            ],
        });

        if (!task) {
            throw new Error('Task not found');
        }

        // Check if user is subscribed
        const isSubscribed = task.Subscribers.some(
            (sub) => sub.id === subscriberUserId
        );

        if (!isSubscribed) {
            throw new Error('User not subscribed to task');
        }

        // Remove subscriber
        await task.removeSubscriber(subscriberUserId);

        // Remove permission record (only those with propagation: 'subscription')
        await Permission.destroy({
            where: {
                user_id: subscriberUserId,
                resource_type: 'task',
                resource_uid: task.uid,
                propagation: 'subscription',
            },
        });

        // Reload task with updated subscribers
        await task.reload({
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: [] },
                },
            ],
        });

        return task;
    } catch (error) {
        logError('Error unsubscribing from task:', error);
        throw error;
    }
}

/**
 * Get all subscribers for a task
 *
 * @param {number} taskId - Task ID
 * @returns {Promise<User[]>} - Array of subscriber users
 */
async function getTaskSubscribers(taskId) {
    try {
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                    through: { attributes: [] },
                },
            ],
        });

        if (!task) {
            throw new Error('Task not found');
        }

        return task.Subscribers || [];
    } catch (error) {
        logError('Error getting task subscribers:', error);
        throw error;
    }
}

/**
 * Check if user is subscribed to task
 *
 * @param {number} taskId - Task ID
 * @param {number} userId - User ID to check
 * @returns {Promise<boolean>}
 */
async function isUserSubscribed(taskId, userId) {
    try {
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: ['id'],
                    through: { attributes: [] },
                },
            ],
        });

        if (!task) {
            return false;
        }

        return task.Subscribers.some((sub) => sub.id === userId);
    } catch (error) {
        logError('Error checking subscription:', error);
        return false;
    }
}

/**
 * Notify all subscribers about task change
 * Implements deduplication to avoid notifying users who are also owner/assignee
 *
 * @param {Task} task - The task that changed
 * @param {string} changeType - Type of change ('status', 'update', 'assignment')
 * @param {User} actorUser - User who made the change
 * @param {object} changeDetails - Additional details about change
 */
async function notifySubscribers(
    task,
    changeType,
    actorUser,
    changeDetails = {}
) {
    try {
        // Load task with all relationships
        const fullTask = await Task.findByPk(task.id, {
            include: [
                {
                    model: User,
                    as: 'Subscribers',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'notification_preferences',
                    ],
                    through: { attributes: [] },
                },
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
                {
                    model: User,
                    as: 'AssignedTo',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
        });

        if (
            !fullTask ||
            !fullTask.Subscribers ||
            fullTask.Subscribers.length === 0
        ) {
            return; // No subscribers to notify
        }

        // Determine notification type based on change type
        let notificationType;
        let title;
        let message;

        const actorName = actorUser.name || actorUser.email;

        switch (changeType) {
            case 'status':
                notificationType = 'task_status_changed_for_subscriber';
                title = 'Subscribed task status changed';
                message = `${actorName} changed status of "${fullTask.name}"`;
                if (
                    changeDetails.newStatus === 2 ||
                    changeDetails.newStatus === 'done'
                ) {
                    message = `${actorName} marked "${fullTask.name}" as completed`;
                }
                break;
            case 'update':
                notificationType = 'task_updated_for_subscriber';
                title = 'Subscribed task updated';
                message = `${actorName} updated "${fullTask.name}"`;
                if (changeDetails.field) {
                    message = `${actorName} updated ${changeDetails.field} in "${fullTask.name}"`;
                }
                break;
            case 'assignment':
                notificationType = 'task_assignment_changed_for_subscriber';
                title = 'Assignment changed on subscribed task';
                message = `${actorName} changed assignment of "${fullTask.name}"`;
                break;
            default:
                notificationType = 'task_updated_for_subscriber';
                title = 'Subscribed task updated';
                message = `${actorName} updated "${fullTask.name}"`;
        }

        // Notify each subscriber
        for (const subscriber of fullTask.Subscribers) {
            // Skip if subscriber is the actor (don't notify about own changes)
            if (subscriber.id === actorUser.id) {
                continue;
            }

            // Skip if subscriber is the owner (owner gets separate notifications)
            if (fullTask.Owner && subscriber.id === fullTask.Owner.id) {
                continue;
            }

            // Skip if subscriber is the assignee (assignee gets separate notifications)
            if (
                fullTask.AssignedTo &&
                subscriber.id === fullTask.AssignedTo.id
            ) {
                continue;
            }

            // Check if user has opted in to this notification type
            if (!shouldSendInAppNotification(subscriber, notificationType)) {
                continue;
            }

            // Build sources array based on user preferences
            const sources = [];
            if (shouldSendTelegramNotification(subscriber, notificationType)) {
                sources.push('telegram');
            }

            await Notification.createNotification({
                userId: subscriber.id,
                type: notificationType,
                title,
                message,
                level: 'info',
                sources,
                data: {
                    taskUid: fullTask.uid,
                    taskName: fullTask.name,
                    changedBy: actorName,
                    changedByUid: actorUser.uid,
                    changeType,
                    ...changeDetails,
                },
                sentAt: new Date(),
            });
        }
    } catch (error) {
        logError('Error notifying subscribers:', error);
        // Don't throw - notification failure shouldn't break task updates
    }
}

/**
 * Notify subscribers about task update
 * Helper function for task update scenarios
 *
 * @param {Task} task - The task that was updated
 * @param {User} actorUser - User who made the update
 * @param {object} updatedFields - Fields that were updated
 * @param {object} oldValues - Old values before update
 */
async function notifySubscribersAboutUpdate(
    task,
    actorUser,
    updatedFields,
    oldValues = {}
) {
    try {
        // Determine what changed
        const changeDetails = {
            fields: Object.keys(updatedFields),
        };

        // If status changed, use status notification
        if (updatedFields.status !== undefined) {
            changeDetails.newStatus = updatedFields.status;
            changeDetails.oldStatus = oldValues.status;
            await notifySubscribers(task, 'status', actorUser, changeDetails);
        } else if (updatedFields.assigned_to_user_id !== undefined) {
            // If assignment changed, use assignment notification
            await notifySubscribers(
                task,
                'assignment',
                actorUser,
                changeDetails
            );
        } else {
            // General update notification
            if (updatedFields.name) changeDetails.field = 'name';
            else if (updatedFields.due_date) changeDetails.field = 'due date';
            else if (updatedFields.priority) changeDetails.field = 'priority';
            else if (updatedFields.note) changeDetails.field = 'notes';

            await notifySubscribers(task, 'update', actorUser, changeDetails);
        }
    } catch (error) {
        logError('Error notifying subscribers about update:', error);
        // Don't throw
    }
}

/**
 * Notify subscribers about task status change
 * Helper function for task completion/status change scenarios
 *
 * @param {Task} task - The task whose status changed
 * @param {User} changedBy - User who changed the status
 */
async function notifySubscribersAboutStatusChange(task, changedBy) {
    try {
        const changeDetails = {
            newStatus: task.status,
        };

        await notifySubscribers(task, 'status', changedBy, changeDetails);
    } catch (error) {
        logError('Error notifying subscribers about status change:', error);
        // Don't throw
    }
}

module.exports = {
    subscribeToTask,
    unsubscribeFromTask,
    getTaskSubscribers,
    isUserSubscribed,
    notifySubscribers,
    notifySubscribersAboutUpdate,
    notifySubscribersAboutStatusChange,
};
