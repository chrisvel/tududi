const {
    getSafeTimezone,
    processDueDateForResponse,
    processDeferUntilForResponse,
} = require('../../../utils/timezone-utils');
const {
    getTaskTodayMoveCount,
    getTaskTodayMoveCounts,
} = require('../../../services/taskEventService');
const taskRepository = require('../../../repositories/TaskRepository');

async function serializeTask(
    task,
    userTimezone = 'UTC',
    options = {},
    moveCountMap = null
) {
    if (!task) {
        throw new Error('Task is null or undefined');
    }
    const taskJson = task.toJSON();

    const todayMoveCount = moveCountMap
        ? moveCountMap[task.id] || 0
        : await getTaskTodayMoveCount(task.id);

    const safeTimezone = getSafeTimezone(userTimezone);

    const { Subtasks, ...taskWithoutSubtasks } = taskJson;

    let displayName = taskJson.name;
    if (
        !options.skipDisplayNameTransform &&
        !options.preserveOriginalName &&
        taskJson.recurrence_type &&
        taskJson.recurrence_type !== 'none' &&
        !taskJson.recurring_parent_id
    ) {
        switch (taskJson.recurrence_type) {
            case 'daily':
                displayName = 'Daily';
                break;
            case 'weekly':
                displayName = 'Weekly';
                break;
            case 'monthly':
                displayName = 'Monthly';
                break;
            case 'yearly':
                displayName = 'Yearly';
                break;
            default:
                displayName =
                    taskJson.recurrence_type.charAt(0).toUpperCase() +
                    taskJson.recurrence_type.slice(1);
        }
    }

    let recurringParentUid = null;
    if (taskJson.recurring_parent_id) {
        const parentTask = await taskRepository.findById(
            taskJson.recurring_parent_id,
            {
                attributes: ['uid'],
            }
        );
        recurringParentUid = parentTask?.uid || null;
    }

    return {
        ...taskWithoutSubtasks,
        name: displayName,
        original_name: taskJson.name,
        uid: task.uid,
        recurring_parent_uid: recurringParentUid,
        due_date: processDueDateForResponse(taskJson.due_date, safeTimezone),
        defer_until: processDeferUntilForResponse(
            taskJson.defer_until,
            safeTimezone
        ),
        tags: taskJson.Tags || [],
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  uid: taskJson.Project.uid,
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => ({
                  ...subtask,
                  uid: subtask.uid,
                  tags: subtask.Tags || [],
                  due_date: processDueDateForResponse(
                      subtask.due_date,
                      safeTimezone
                  ),
                  defer_until: processDeferUntilForResponse(
                      subtask.defer_until,
                      safeTimezone
                  ),
                  completed_at: subtask.completed_at
                      ? subtask.completed_at instanceof Date
                          ? subtask.completed_at.toISOString()
                          : new Date(subtask.completed_at).toISOString()
                      : null,
              }))
            : [],
        completed_at: task.completed_at
            ? task.completed_at instanceof Date
                ? task.completed_at.toISOString()
                : new Date(task.completed_at).toISOString()
            : null,
        today_move_count: todayMoveCount,
    };
}

async function serializeTasks(tasks, userTimezone = 'UTC', options = {}) {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const taskIds = tasks.map((task) => task.id);
    const moveCountMap = await getTaskTodayMoveCounts(taskIds);

    return await Promise.all(
        tasks.map((task) =>
            serializeTask(task, userTimezone, options, moveCountMap)
        )
    );
}

async function buildMetricsResponse(metrics) {
    return {
        total_open_tasks: metrics.total_open_tasks,
        tasks_pending_over_month: metrics.tasks_pending_over_month,
        tasks_in_progress_count: metrics.tasks_in_progress_count,
        tasks_due_today_count: metrics.tasks_due_today.length,
        today_plan_tasks_count: metrics.today_plan_tasks.length,
        suggested_tasks_count: metrics.suggested_tasks.length,
        tasks_completed_today_count: metrics.tasks_completed_today.length,
        weekly_completions: metrics.weekly_completions,
    };
}

module.exports = {
    serializeTask,
    serializeTasks,
    buildMetricsResponse,
};
