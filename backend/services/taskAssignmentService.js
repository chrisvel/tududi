const { Task, User, Permission, Notification } = require('../models');
const { logError } = require('./logService');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../utils/notificationPreferences');

/**
 * Assign a task to a user
 * Creates permission and sends notification
 *
 * @param {number} taskId - Task ID to assign
 * @param {number} assignedToUserId - User ID to assign to
 * @param {number} assignedByUserId - User ID performing the assignment
 * @returns {Promise<Task>} - Updated task with AssignedTo user
 */
async function assignTask(taskId, assignedToUserId, assignedByUserId) {
    try {
        // Load task with owner
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
        });

        if (!task) {
            throw new Error('Task not found');
        }

        // Verify assigner has permission (must be owner or already have write access)
        if (task.user_id !== assignedByUserId) {
            // TODO: Check if assigner has write permission via Permission model
            throw new Error('Not authorized to assign this task');
        }

        // Load assignee user
        const assignee = await User.findByPk(assignedToUserId, {
            attributes: [
                'id',
                'uid',
                'email',
                'name',
                'surname',
                'notification_preferences',
            ],
        });

        if (!assignee) {
            throw new Error('Assignee user not found');
        }

        // Update task assignment
        task.assigned_to_user_id = assignedToUserId;
        await task.save();

        // Create or update permission record
        // Use propagation: 'assignment' to distinguish from manual shares
        const [permission, created] = await Permission.findOrCreate({
            where: {
                user_id: assignedToUserId,
                resource_type: 'task',
                resource_uid: task.uid,
            },
            defaults: {
                access_level: 'rw',
                propagation: 'assignment',
                granted_by_user_id: assignedByUserId,
            },
        });

        // If permission already existed, update it
        if (!created) {
            permission.access_level = 'rw';
            permission.propagation = 'assignment';
            permission.granted_by_user_id = assignedByUserId;
            await permission.save();
        }

        // Send notification to assignee
        await notifyAssignment(task, assignee, task.Owner);

        // Reload task with AssignedTo user
        const updatedTask = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                },
                {
                    model: User,
                    as: 'AssignedTo',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                },
            ],
        });

        return updatedTask;
    } catch (error) {
        logError('Error assigning task:', error);
        throw error;
    }
}

/**
 * Unassign a task from a user
 * Removes permission and sends notification
 *
 * @param {number} taskId - Task ID to unassign
 * @param {number} unassignedByUserId - User ID performing the unassignment
 * @returns {Promise<Task>} - Updated task
 */
async function unassignTask(taskId, unassignedByUserId) {
    try {
        // Load task with current assignee
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'AssignedTo',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'notification_preferences',
                    ],
                },
                {
                    model: User,
                    as: 'Owner',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
        });

        if (!task) {
            throw new Error('Task not found');
        }

        // Verify unassigner has permission (must be owner or assignee)
        if (
            task.user_id !== unassignedByUserId &&
            task.assigned_to_user_id !== unassignedByUserId
        ) {
            throw new Error('Not authorized to unassign this task');
        }

        if (!task.assigned_to_user_id) {
            throw new Error('Task is not assigned');
        }

        const previouslyAssignedUser = task.AssignedTo;
        const previousAssignedToId = task.assigned_to_user_id;

        // Remove assignment
        task.assigned_to_user_id = null;
        await task.save();

        // Remove permission record (only those created by assignment)
        await Permission.destroy({
            where: {
                user_id: previousAssignedToId,
                resource_type: 'task',
                resource_uid: task.uid,
                propagation: 'assignment',
            },
        });

        // Send notification to previously assigned user
        if (previouslyAssignedUser) {
            await notifyUnassignment(task, previouslyAssignedUser, task.Owner);
        }

        // Reload task
        const updatedTask = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'Owner',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                },
                {
                    model: User,
                    as: 'AssignedTo',
                    attributes: [
                        'id',
                        'uid',
                        'email',
                        'name',
                        'surname',
                        'avatar_image',
                    ],
                },
            ],
        });

        return updatedTask;
    } catch (error) {
        logError('Error unassigning task:', error);
        throw error;
    }
}

/**
 * Send notification when a task is assigned
 *
 * @param {Task} task - The task being assigned
 * @param {User} assignee - User being assigned to
 * @param {User} assigner - User who assigned the task
 */
async function notifyAssignment(task, assignee, assigner) {
    try {
        const notificationType = 'task_assigned';

        // Check if assignee wants this notification
        if (!shouldSendInAppNotification(assignee, notificationType)) {
            return;
        }

        const assignerName = assigner.name || assigner.email;

        const title = 'Task assigned to you';
        const message = `${assignerName} assigned you the task "${task.name}"`;

        // Build sources array based on user preferences
        const sources = [];
        if (shouldSendTelegramNotification(assignee, notificationType)) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: assignee.id,
            type: notificationType,
            title,
            message,
            level: 'info',
            sources,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                assignedBy: assignerName,
                assignedByUid: assigner.uid,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error sending assignment notification:', error);
        // Don't throw - notification failure shouldn't break assignment
    }
}

/**
 * Send notification when a task is unassigned
 *
 * @param {Task} task - The task being unassigned
 * @param {User} previousAssignee - User being unassigned from
 * @param {User} unassigner - User who unassigned the task
 */
async function notifyUnassignment(task, previousAssignee, unassigner) {
    try {
        const notificationType = 'task_unassigned';

        // Check if user wants this notification
        if (!shouldSendInAppNotification(previousAssignee, notificationType)) {
            return;
        }

        const title = 'Task unassigned';
        const message = `You were unassigned from "${task.name}"`;

        // Build sources array based on user preferences
        const sources = [];
        if (
            shouldSendTelegramNotification(previousAssignee, notificationType)
        ) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: previousAssignee.id,
            type: notificationType,
            title,
            message,
            level: 'info',
            sources,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                unassignedBy: unassigner.name || unassigner.email,
                unassignedByUid: unassigner.uid,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error sending unassignment notification:', error);
        // Don't throw - notification failure shouldn't break unassignment
    }
}

/**
 * Send notification to task owner when assigned task is completed
 *
 * @param {Task} task - The completed task
 * @param {User} assignee - User who was assigned and completed the task
 * @param {User} owner - Task owner
 */
async function notifyTaskCompletion(task, assignee, owner) {
    try {
        const notificationType = 'assigned_task_completed';

        // Check if owner wants this notification
        if (!shouldSendInAppNotification(owner, notificationType)) {
            return;
        }

        // Don't notify if owner completed their own task
        if (owner.id === assignee.id) {
            return;
        }

        const assigneeName = assignee.name || assignee.email;

        const title = 'Assigned task completed';
        const message = `${assigneeName} completed "${task.name}"`;

        // Build sources array based on user preferences
        const sources = [];
        if (shouldSendTelegramNotification(owner, notificationType)) {
            sources.push('telegram');
        }

        await Notification.createNotification({
            userId: owner.id,
            type: notificationType,
            title,
            message,
            level: 'success',
            sources,
            data: {
                taskUid: task.uid,
                taskName: task.name,
                completedBy: assigneeName,
                completedByUid: assignee.uid,
                completedAt: task.completed_at,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error sending task completion notification:', error);
        // Don't throw - notification failure shouldn't break completion
    }
}

module.exports = {
    assignTask,
    unassignTask,
    notifyAssignment,
    notifyUnassignment,
    notifyTaskCompletion,
};
