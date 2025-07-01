const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskEvent = sequelize.define(
        'TaskEvent',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            event_type: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [
                        [
                            'created',
                            'status_changed',
                            'priority_changed',
                            'due_date_changed',
                            'project_changed',
                            'name_changed',
                            'description_changed',
                            'note_changed',
                            'completed',
                            'archived',
                            'deleted',
                            'restored',
                            'today_changed',
                            'tags_changed',
                            'recurrence_changed',
                            'recurrence_type_changed',
                            'completion_based_changed',
                            'recurrence_end_date_changed',
                        ],
                    ],
                },
            },
            old_value: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('old_value');
                    return rawValue ? JSON.parse(rawValue) : null;
                },
                set(value) {
                    this.setDataValue(
                        'old_value',
                        value ? JSON.stringify(value) : null
                    );
                },
            },
            new_value: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('new_value');
                    return rawValue ? JSON.parse(rawValue) : null;
                },
                set(value) {
                    this.setDataValue(
                        'new_value',
                        value ? JSON.stringify(value) : null
                    );
                },
            },
            field_name: {
                type: DataTypes.STRING,
                allowNull: true,
                validate: {
                    isIn: [
                        [
                            'status',
                            'priority',
                            'due_date',
                            'project_id',
                            'name',
                            'description',
                            'note',
                            'today',
                            'tags',
                            'recurrence_type',
                            'recurrence_interval',
                            'recurrence_end_date',
                            'recurrence_weekday',
                            'recurrence_month_day',
                            'recurrence_week_of_month',
                            'completion_based',
                        ],
                    ],
                },
            },
            metadata: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue('metadata');
                    return rawValue ? JSON.parse(rawValue) : null;
                },
                set(value) {
                    this.setDataValue(
                        'metadata',
                        value ? JSON.stringify(value) : null
                    );
                },
            },
        },
        {
            tableName: 'task_events',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false, // We don't need updated_at for events (they're immutable)
            indexes: [
                {
                    fields: ['task_id'],
                },
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['event_type'],
                },
                {
                    fields: ['created_at'],
                },
                {
                    fields: ['task_id', 'event_type'],
                },
                {
                    fields: ['task_id', 'created_at'],
                },
            ],
        }
    );

    // Define associations
    TaskEvent.associate = function (models) {
        // TaskEvent belongs to Task
        TaskEvent.belongsTo(models.Task, {
            foreignKey: 'task_id',
            as: 'Task',
        });

        // TaskEvent belongs to User
        TaskEvent.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    // Helper methods for common event types
    TaskEvent.createStatusChangeEvent = async function (
        taskId,
        userId,
        oldStatus,
        newStatus,
        metadata = {}
    ) {
        return await TaskEvent.create({
            task_id: taskId,
            user_id: userId,
            event_type: 'status_changed',
            field_name: 'status',
            old_value: { status: oldStatus },
            new_value: { status: newStatus },
            metadata: metadata,
        });
    };

    TaskEvent.createTaskCreatedEvent = async function (
        taskId,
        userId,
        taskData,
        metadata = {}
    ) {
        return await TaskEvent.create({
            task_id: taskId,
            user_id: userId,
            event_type: 'created',
            field_name: null,
            old_value: null,
            new_value: taskData,
            metadata: metadata,
        });
    };

    TaskEvent.createFieldChangeEvent = async function (
        taskId,
        userId,
        fieldName,
        oldValue,
        newValue,
        metadata = {}
    ) {
        const eventType =
            fieldName === 'status' && newValue === 2
                ? 'completed'
                : fieldName === 'status' && newValue === 3
                  ? 'archived'
                  : `${fieldName}_changed`;

        return await TaskEvent.create({
            task_id: taskId,
            user_id: userId,
            event_type: eventType,
            field_name: fieldName,
            old_value: { [fieldName]: oldValue },
            new_value: { [fieldName]: newValue },
            metadata: metadata,
        });
    };

    // Query helpers
    TaskEvent.getTaskTimeline = async function (taskId) {
        return await TaskEvent.findAll({
            where: { task_id: taskId },
            order: [['created_at', 'ASC']],
            include: [
                {
                    model: sequelize.models.User,
                    as: 'User',
                    attributes: ['id', 'name', 'email'],
                },
            ],
        });
    };

    TaskEvent.getCompletionTime = async function (taskId) {
        const events = await TaskEvent.findAll({
            where: {
                task_id: taskId,
                event_type: ['status_changed', 'created', 'completed'],
            },
            order: [['created_at', 'ASC']],
        });

        if (events.length === 0) return null;

        const startEvent = events.find(
            (e) =>
                e.event_type === 'created' ||
                (e.event_type === 'status_changed' && e.new_value?.status === 1) // in_progress
        );

        const completedEvent = events.find(
            (e) =>
                e.event_type === 'completed' ||
                (e.event_type === 'status_changed' && e.new_value?.status === 2) // done
        );

        if (!startEvent || !completedEvent) return null;

        const startTime = new Date(startEvent.created_at);
        const endTime = new Date(completedEvent.created_at);

        return {
            started_at: startTime,
            completed_at: endTime,
            duration_ms: endTime - startTime,
            duration_hours: (endTime - startTime) / (1000 * 60 * 60),
        };
    };

    return TaskEvent;
};
