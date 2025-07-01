const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Task = sequelize.define(
        'Task',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                defaultValue: DataTypes.UUIDV4,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            due_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            today: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 0,
                validate: {
                    min: 0,
                    max: 2,
                },
            },
            status: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: 0,
                    max: 4,
                },
            },
            note: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            recurrence_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'none',
            },
            recurrence_interval: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            recurrence_end_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_generated_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            recurrence_weekday: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: 0,
                    max: 6,
                },
            },
            recurrence_month_day: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: -1,
                    max: 31,
                },
            },
            recurrence_week_of_month: {
                type: DataTypes.INTEGER,
                allowNull: true,
                validate: {
                    min: 1,
                    max: 5,
                },
            },
            completion_based: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'projects',
                    key: 'id',
                },
            },
            recurring_parent_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            completed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'tasks',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['project_id'],
                },
                {
                    fields: ['recurrence_type'],
                },
                {
                    fields: ['last_generated_date'],
                },
            ],
        }
    );

    // Define associations
    Task.associate = function (models) {
        // Self-referencing association for recurring tasks
        Task.belongsTo(models.Task, {
            as: 'RecurringParent',
            foreignKey: 'recurring_parent_id',
        });

        Task.hasMany(models.Task, {
            as: 'RecurringChildren',
            foreignKey: 'recurring_parent_id',
        });
    };

    // Define enum constants
    Task.PRIORITY = {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
    };

    Task.STATUS = {
        NOT_STARTED: 0,
        IN_PROGRESS: 1,
        DONE: 2,
        ARCHIVED: 3,
        WAITING: 4,
    };

    Task.RECURRENCE_TYPE = {
        NONE: 'none',
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        MONTHLY_WEEKDAY: 'monthly_weekday',
        MONTHLY_LAST_DAY: 'monthly_last_day',
    };

    // priority and status
    const getPriorityName = (priorityValue) => {
        const priorities = ['low', 'medium', 'high'];
        return priorities[priorityValue] || 'low';
    };

    const getStatusName = (statusValue) => {
        const statuses = [
            'not_started',
            'in_progress',
            'done',
            'archived',
            'waiting',
        ];
        return statuses[statusValue] || 'not_started';
    };

    const getPriorityValue = (priorityName) => {
        const priorities = { low: 0, medium: 1, high: 2 };
        return priorities[priorityName] !== undefined
            ? priorities[priorityName]
            : 0;
    };

    const getStatusValue = (statusName) => {
        const statuses = {
            not_started: 0,
            in_progress: 1,
            done: 2,
            archived: 3,
            waiting: 4,
        };
        return statuses[statusName] !== undefined ? statuses[statusName] : 0;
    };

    // Attach utility functions to model
    Task.getPriorityName = getPriorityName;
    Task.getStatusName = getStatusName;
    Task.getPriorityValue = getPriorityValue;
    Task.getStatusValue = getStatusValue;

    return Task;
};
