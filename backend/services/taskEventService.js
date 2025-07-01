const { TaskEvent } = require('../models');

class TaskEventService {
    /**
     * Log a task event
     * @param {Object} eventData - Event data
     * @param {number} eventData.taskId - Task ID
     * @param {number} eventData.userId - User ID
     * @param {string} eventData.eventType - Type of event
     * @param {string} eventData.fieldName - Field that changed (optional)
     * @param {any} eventData.oldValue - Old value (optional)
     * @param {any} eventData.newValue - New value (optional)
     * @param {Object} eventData.metadata - Additional metadata (optional)
     */
    static async logEvent({
        taskId,
        userId,
        eventType,
        fieldName = null,
        oldValue = null,
        newValue = null,
        metadata = {},
    }) {
        try {
            // Add source to metadata if not provided
            if (!metadata.source) {
                metadata.source = 'web';
            }

            const event = await TaskEvent.create({
                task_id: taskId,
                user_id: userId,
                event_type: eventType,
                field_name: fieldName,
                old_value: oldValue
                    ? { [fieldName || 'value']: oldValue }
                    : null,
                new_value: newValue
                    ? { [fieldName || 'value']: newValue }
                    : null,
                metadata: metadata,
            });

            return event;
        } catch (error) {
            console.error('Error logging task event:', error);
            throw error;
        }
    }

    /**
     * Log task creation event
     */
    static async logTaskCreated(taskId, userId, taskData, metadata = {}) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'created',
            newValue: taskData,
            metadata: { ...metadata, action: 'task_created' },
        });
    }

    /**
     * Log status change event
     */
    static async logStatusChange(
        taskId,
        userId,
        oldStatus,
        newStatus,
        metadata = {}
    ) {
        const eventType =
            newStatus === 2
                ? 'completed'
                : newStatus === 3
                  ? 'archived'
                  : 'status_changed';

        return await this.logEvent({
            taskId,
            userId,
            eventType,
            fieldName: 'status',
            oldValue: oldStatus,
            newValue: newStatus,
            metadata: { ...metadata, action: 'status_change' },
        });
    }

    /**
     * Log priority change event
     */
    static async logPriorityChange(
        taskId,
        userId,
        oldPriority,
        newPriority,
        metadata = {}
    ) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'priority_changed',
            fieldName: 'priority',
            oldValue: oldPriority,
            newValue: newPriority,
            metadata: { ...metadata, action: 'priority_change' },
        });
    }

    /**
     * Log due date change event
     */
    static async logDueDateChange(
        taskId,
        userId,
        oldDueDate,
        newDueDate,
        metadata = {}
    ) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'due_date_changed',
            fieldName: 'due_date',
            oldValue: oldDueDate,
            newValue: newDueDate,
            metadata: { ...metadata, action: 'due_date_change' },
        });
    }

    /**
     * Log project change event
     */
    static async logProjectChange(
        taskId,
        userId,
        oldProjectId,
        newProjectId,
        metadata = {}
    ) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'project_changed',
            fieldName: 'project_id',
            oldValue: oldProjectId,
            newValue: newProjectId,
            metadata: { ...metadata, action: 'project_change' },
        });
    }

    /**
     * Log task name change event
     */
    static async logNameChange(
        taskId,
        userId,
        oldName,
        newName,
        metadata = {}
    ) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'name_changed',
            fieldName: 'name',
            oldValue: oldName,
            newValue: newName,
            metadata: { ...metadata, action: 'name_change' },
        });
    }

    /**
     * Log description change event
     */
    static async logDescriptionChange(
        taskId,
        userId,
        oldDescription,
        newDescription,
        metadata = {}
    ) {
        return await this.logEvent({
            taskId,
            userId,
            eventType: 'description_changed',
            fieldName: 'description',
            oldValue: oldDescription,
            newValue: newDescription,
            metadata: { ...metadata, action: 'description_change' },
        });
    }

    /**
     * Log multiple field changes at once
     */
    static async logTaskUpdate(taskId, userId, changes, metadata = {}) {
        const events = [];

        for (const [fieldName, { oldValue, newValue }] of Object.entries(
            changes
        )) {
            // Skip if values are the same
            if (oldValue === newValue) continue;

            let eventType;
            switch (fieldName) {
                case 'status':
                    eventType =
                        newValue === 2
                            ? 'completed'
                            : newValue === 3
                              ? 'archived'
                              : 'status_changed';
                    break;
                default:
                    eventType = `${fieldName}_changed`;
            }

            const event = await this.logEvent({
                taskId,
                userId,
                eventType,
                fieldName,
                oldValue,
                newValue,
                metadata: { ...metadata, action: 'bulk_update' },
            });

            events.push(event);
        }

        return events;
    }

    /**
     * Get task timeline (all events for a task)
     */
    static async getTaskTimeline(taskId) {
        return await TaskEvent.findAll({
            where: { task_id: taskId },
            order: [['created_at', 'ASC']],
            include: [
                {
                    model: require('../models').User,
                    as: 'User',
                    attributes: ['id', 'name', 'email'],
                },
            ],
        });
    }

    /**
     * Get task completion metrics
     */
    static async getTaskCompletionTime(taskId) {
        const events = await TaskEvent.findAll({
            where: {
                task_id: taskId,
                event_type: ['status_changed', 'created', 'completed'],
            },
            order: [['created_at', 'ASC']],
        });

        if (events.length === 0) return null;

        // Find when task was started (moved to in_progress or created)
        const startEvent = events.find(
            (e) =>
                e.event_type === 'created' ||
                (e.event_type === 'status_changed' && e.new_value?.status === 1) // in_progress
        );

        // Find when task was completed
        const completedEvent = events.find(
            (e) =>
                e.event_type === 'completed' ||
                (e.event_type === 'status_changed' && e.new_value?.status === 2) // done
        );

        if (!startEvent || !completedEvent) return null;

        const startTime = new Date(startEvent.created_at);
        const endTime = new Date(completedEvent.created_at);

        return {
            task_id: taskId,
            started_at: startTime,
            completed_at: endTime,
            duration_ms: endTime - startTime,
            duration_hours: (endTime - startTime) / (1000 * 60 * 60),
            duration_days: (endTime - startTime) / (1000 * 60 * 60 * 24),
        };
    }

    /**
     * Get user productivity metrics
     */
    static async getUserProductivityMetrics(
        userId,
        startDate = null,
        endDate = null
    ) {
        const whereClause = { user_id: userId };

        if (startDate && endDate) {
            whereClause.created_at = {
                [require('sequelize').Op.between]: [startDate, endDate],
            };
        }

        const events = await TaskEvent.findAll({
            where: whereClause,
            order: [['created_at', 'ASC']],
        });

        // Calculate metrics
        const metrics = {
            total_events: events.length,
            tasks_created: events.filter((e) => e.event_type === 'created')
                .length,
            tasks_completed: events.filter((e) => e.event_type === 'completed')
                .length,
            status_changes: events.filter(
                (e) => e.event_type === 'status_changed'
            ).length,
            average_completion_time: null,
            completion_times: [],
        };

        // Calculate completion times for all completed tasks
        const completedTasks = events.filter(
            (e) => e.event_type === 'completed'
        );
        const completionTimes = [];

        for (const completedEvent of completedTasks) {
            const taskCompletion = await this.getTaskCompletionTime(
                completedEvent.task_id
            );
            if (taskCompletion) {
                completionTimes.push(taskCompletion);
            }
        }

        if (completionTimes.length > 0) {
            const totalHours = completionTimes.reduce(
                (sum, ct) => sum + ct.duration_hours,
                0
            );
            metrics.average_completion_time =
                totalHours / completionTimes.length;
            metrics.completion_times = completionTimes;
        }

        return metrics;
    }

    /**
     * Get task activity summary for a date range
     */
    static async getTaskActivitySummary(userId, startDate, endDate) {
        const events = await TaskEvent.findAll({
            where: {
                user_id: userId,
                created_at: {
                    [require('sequelize').Op.between]: [startDate, endDate],
                },
            },
            attributes: [
                'event_type',
                [
                    require('sequelize').fn(
                        'COUNT',
                        require('sequelize').col('id')
                    ),
                    'count',
                ],
                [
                    require('sequelize').fn(
                        'DATE',
                        require('sequelize').col('created_at')
                    ),
                    'date',
                ],
            ],
            group: ['event_type', 'date'],
            order: [['date', 'ASC']],
        });

        return events;
    }

    /**
     * Get count of how many times a task has been moved to today
     */
    static async getTaskTodayMoveCount(taskId) {
        const { Op } = require('sequelize');

        const count = await TaskEvent.count({
            where: {
                task_id: taskId,
                event_type: 'today_changed',
                new_value: {
                    [Op.like]: '%"today":true%',
                },
            },
        });

        return count;
    }
}

module.exports = TaskEventService;
