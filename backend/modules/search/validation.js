'use strict';

const VALID_TASK_STATUS_FILTERS = ['active', 'completed', 'all'];

// Specific task statuses a search or view can be narrowed to, mapped to the
// Task.STATUS integers.
const TASK_STATUS_FILTERS = {
    not_started: 0,
    in_progress: 1,
    done: 2,
    archived: 3,
    waiting: 4,
    cancelled: 5,
    planned: 6,
};

/**
 * Parse and validate search query parameters.
 */
function parseSearchParams(query) {
    const {
        q,
        filters,
        priority,
        due,
        defer,
        tags: tagsParam,
        recurring,
        extras: extrasParam,
        limit: limitParam,
        offset: offsetParam,
        excludeSubtasks,
        status: statusParam,
        task_status: taskStatusParam,
    } = query;

    const searchQuery = q ? q.trim() : '';

    const filterTypes = filters
        ? filters.split(',').map((f) => f.trim())
        : ['Task', 'Project', 'Area', 'Note', 'Tag'];

    const status = VALID_TASK_STATUS_FILTERS.includes(statusParam)
        ? statusParam
        : undefined;

    const taskStatus = Object.prototype.hasOwnProperty.call(
        TASK_STATUS_FILTERS,
        taskStatusParam
    )
        ? TASK_STATUS_FILTERS[taskStatusParam]
        : undefined;

    const tagNames = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : [];

    const extras =
        extrasParam && typeof extrasParam === 'string'
            ? extrasParam
                  .split(',')
                  .map((extra) => extra.trim())
                  .filter(Boolean)
            : [];

    const hasPagination = limitParam !== undefined || offsetParam !== undefined;
    const limit = hasPagination ? parseInt(limitParam, 10) || 20 : 20;
    const offset = hasPagination ? parseInt(offsetParam, 10) || 0 : 0;

    return {
        searchQuery,
        filterTypes,
        priority,
        due,
        defer,
        tagNames,
        recurring,
        extras: new Set(extras),
        hasPagination,
        limit,
        offset,
        excludeSubtasks: excludeSubtasks === 'true',
        status,
        taskStatus,
    };
}

/**
 * Convert priority string to integer.
 */
function priorityToInt(priorityStr) {
    const priorityMap = {
        low: 0,
        medium: 1,
        high: 2,
    };
    return priorityMap[priorityStr] !== undefined
        ? priorityMap[priorityStr]
        : null;
}

module.exports = {
    TASK_STATUS_FILTERS,
    parseSearchParams,
    priorityToInt,
};
