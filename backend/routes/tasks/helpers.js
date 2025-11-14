// Core functions
const { serializeTask, serializeTasks } = require('./core/serializers');

// Operations
const { updateTaskTags } = require('./operations/tags');

// Queries
const { filterTasksByParams } = require('./queries/query-builders');

module.exports = {
    // Serializers
    serializeTask,
    serializeTasks,

    // Tags
    updateTaskTags,

    // Queries
    filterTasksByParams,
};
