const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const TaskSchema = new mongoose.Schema({
    uuid: {
        type: String,
        default: uuidv4,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    due_date: {
        type: Date,
    },
    today: {
        type: Boolean,
        default: false,
    },
    priority: {
        type: Number,
        default: 0,
        min: 0,
        max: 2,
    },
    status: {
        type: Number,
        default: 0,
        min: 0,
        max: 4,
    },
    note: {
        type: String,
        trim: true,
    },
    recurrence_type: {
        type: String,
        default: 'none',
        enum: [
            'none',
            'daily',
            'weekly',
            'monthly',
            'monthly_weekday',
            'monthly_last_day',
        ],
    },
    recurrence_interval: {
        type: Number,
    },
    recurrence_end_date: {
        type: Date,
    },
    last_generated_date: {
        type: Date,
    },
    recurrence_weekday: {
        type: Number,
        min: 0,
        max: 6,
    },
    recurrence_month_day: {
        type: Number,
        min: -1,
        max: 31,
    },
    recurrence_week_of_month: {
        type: Number,
        min: 1,
        max: 5,
    },
    completion_based: {
        type: Boolean,
        default: false,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
    },
    recurring_parent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
    },
    completed_at: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Indexes
TaskSchema.index({ user_id: 1 });
TaskSchema.index({ project_id: 1 });
TaskSchema.index({ recurrence_type: 1 });
TaskSchema.index({ last_generated_date: 1 });

// Define enum constants as static properties
TaskSchema.statics.PRIORITY = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
};

TaskSchema.statics.STATUS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    DONE: 2,
    ARCHIVED: 3,
    WAITING: 4,
};

TaskSchema.statics.RECURRENCE_TYPE = {
    NONE: 'none',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    MONTHLY_WEEKDAY: 'monthly_weekday',
    MONTHLY_LAST_DAY: 'monthly_last_day',
};

// Helper methods
TaskSchema.statics.getPriorityName = (priorityValue) => {
    const priorities = ['low', 'medium', 'high'];
    return priorities[priorityValue] || 'low';
};

TaskSchema.statics.getStatusName = (statusValue) => {
    const statuses = [
        'not_started',
        'in_progress',
        'done',
        'archived',
        'waiting',
    ];
    return statuses[statusValue] || 'not_started';
};

TaskSchema.statics.getPriorityValue = (priorityName) => {
    const priorities = { low: 0, medium: 1, high: 2 };
    return priorities[priorityName] !== undefined
        ? priorities[priorityName]
        : 0;
};

TaskSchema.statics.getStatusValue = (statusName) => {
    const statuses = {
        not_started: 0,
        in_progress: 1,
        done: 2,
        archived: 3,
        waiting: 4,
    };
    return statuses[statusName] !== undefined ? statuses[statusName] : 0;
};

module.exports = mongoose.model('Task', TaskSchema);