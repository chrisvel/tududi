const mongoose = require('mongoose');

const taskEventSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    event_type: {
        type: String,
        required: true,
        enum: [
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
        ]
    },
    old_value: {
        type: mongoose.Schema.Types.Mixed
    },
    new_value: {
        type: mongoose.Schema.Types.Mixed
    },
    field_name: {
        type: String,
        enum: [
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
        ]
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

const TaskEvent = mongoose.model('TaskEvent', taskEventSchema);

module.exports = TaskEvent;
