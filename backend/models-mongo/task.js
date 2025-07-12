const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const taskSchema = new mongoose.Schema({
    uuid: {
        type: String,
        default: uuidv4,
        unique: true,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    due_date: {
        type: Date
    },
    today: {
        type: Boolean,
        required: true,
        default: false
    },
    priority: {
        type: Number,
        default: 0,
        min: 0,
        max: 2
    },
    status: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 4
    },
    note: {
        type: String
    },
    recurrence_type: {
        type: String,
        required: true,
        default: 'none'
    },
    recurrence_interval: {
        type: Number
    },
    recurrence_end_date: {
        type: Date
    },
    last_generated_date: {
        type: Date
    },
    recurrence_weekday: {
        type: Number,
        min: 0,
        max: 6
    },
    recurrence_month_day: {
        type: Number,
        min: -1,
        max: 31
    },
    recurrence_week_of_month: {
        type: Number,
        min: 1,
        max: 5
    },
    completion_based: {
        type: Boolean,
        required: true,
        default: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    recurring_parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    },
    completed_at: {
        type: Date
    },
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }]
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
