const mongoose = require('mongoose');

const TaskEventSchema = new mongoose.Schema({
    task_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
        ],
    },
    old_value: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    new_value: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
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
        ],
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: false, // We don't need updated_at for events (they're immutable)
    },
});

// Helper methods for common event types
TaskEventSchema.statics.createStatusChangeEvent = async function (
    taskId,
    userId,
    oldStatus,
    newStatus,
    metadata = {}
) {
    return await this.create({
        task_id: taskId,
        user_id: userId,
        event_type: 'status_changed',
        field_name: 'status',
        old_value: { status: oldStatus },
        new_value: { status: newStatus },
        metadata: metadata,
    });
};

TaskEventSchema.statics.createTaskCreatedEvent = async function (
    taskId,
    userId,
    taskData,
    metadata = {}
) {
    return await this.create({
        task_id: taskId,
        user_id: userId,
        event_type: 'created',
        field_name: null,
        old_value: null,
        new_value: taskData,
        metadata: metadata,
    });
};

TaskEventSchema.statics.createFieldChangeEvent = async function (
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

    return await this.create({
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
TaskEventSchema.statics.getTaskTimeline = async function (taskId) {
    return await this.find({ task_id: taskId })
        .sort({ created_at: 1 })
        .populate('user_id', 'name email'); // Populate user details
};

TaskEventSchema.statics.getCompletionTime = async function (taskId) {
    const events = await this.find({
        task_id: taskId,
        event_type: { $in: ['status_changed', 'created', 'completed'] },
    }).sort({ created_at: 1 });

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

module.exports = mongoose.model('TaskEvent', TaskEventSchema);