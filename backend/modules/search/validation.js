'use strict';

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
    } = query;

    const searchQuery = q ? q.trim() : '';

    const filterTypes = filters
        ? filters.split(',').map((f) => f.trim())
        : ['Task', 'Project', 'Area', 'Note', 'Tag'];

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
    parseSearchParams,
    priorityToInt,
};
