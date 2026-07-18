const {
    getSafeTimezone,
    processDueDateForResponse,
    processDeferUntilForResponse,
} = require('../../../utils/timezone-utils');
const {
    getTaskTodayMoveCount,
    getTaskTodayMoveCounts,
} = require('../taskEventService');
const taskRepository = require('../repository');
const { Task } = require('../../../models');
const { Op } = require('sequelize');

// Sort tags alphabetically by name (case-insensitive)
function sortTags(tags) {
    if (!tags || !Array.isArray(tags)) return [];
    return [...tags].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
}

async function serializeTask(
    task,
    userTimezone = 'UTC',
    options = {},
    moveCountMap = null,
    parentUidMap = null
) {
    if (!task) {
        throw new Error('Task is null or undefined');
    }
    const taskJson = task.toJSON ? task.toJSON() : task;

    const todayMoveCount = taskJson.is_virtual_occurrence
        ? 0
        : moveCountMap
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
        if (parentUidMap && taskJson.recurring_parent_id in parentUidMap) {
            recurringParentUid =
                parentUidMap[taskJson.recurring_parent_id] || null;
        } else {
            const parentTask = await taskRepository.findById(
                taskJson.recurring_parent_id,
                { attributes: ['uid'] }
            );
            recurringParentUid = parentTask?.uid || null;
        }
    }

    return {
        ...taskWithoutSubtasks,
        name: displayName,
        original_name: taskJson.name,
        uid: task.uid,
        project_uid: taskJson.Project?.uid || null,
        area_uid: taskJson.Area?.uid || null,
        recurring_parent_uid: recurringParentUid,
        due_date: processDueDateForResponse(taskJson.due_date, safeTimezone),
        defer_until: processDeferUntilForResponse(
            taskJson.defer_until,
            safeTimezone
        ),
        tags: sortTags(taskJson.Tags),
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  uid: taskJson.Project.uid,
              }
            : null,
        Area: taskJson.Area
            ? {
                  ...taskJson.Area,
                  uid: taskJson.Area.uid,
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => ({
                  ...subtask,
                  uid: subtask.uid,
                  tags: sortTags(subtask.Tags),
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

async function serializeTasks(
    tasks,
    userTimezone = 'UTC',
    options = {},
    prebuiltMoveCountMap = null,
    prebuiltParentUidMap = null
) {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const moveCountMap =
        prebuiltMoveCountMap !== null
            ? prebuiltMoveCountMap
            : await getTaskTodayMoveCounts(tasks.map((t) => t.id));

    // Batch-fetch recurring parent UIDs to avoid per-task DB queries
    let parentUidMap = prebuiltParentUidMap;
    if (parentUidMap === null) {
        const parentIds = [
            ...new Set(
                tasks
                    .filter((t) => t.recurring_parent_id)
                    .map((t) => t.recurring_parent_id)
            ),
        ];
        parentUidMap = {};
        if (parentIds.length > 0) {
            const parents = await Task.findAll({
                where: { id: { [Op.in]: parentIds } },
                attributes: ['id', 'uid'],
                raw: true,
            });
            parents.forEach((p) => {
                parentUidMap[p.id] = p.uid;
            });
        }
    }

    return await Promise.all(
        tasks.map((task) =>
            serializeTask(
                task,
                userTimezone,
                options,
                moveCountMap,
                parentUidMap
            )
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
    sortTags,
};
