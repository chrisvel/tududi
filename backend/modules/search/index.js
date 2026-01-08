'use strict';

/**
 * Search Module
 *
 * This module handles universal search across all entity types:
 * - Tasks (with filters for priority, due date, recurring, etc.)
 * - Projects
 * - Areas
 * - Notes
 * - Tags
 *
 * Usage:
 *   const searchModule = require('./modules/search');
 *   app.use('/api/search', searchModule.routes);
 */

const routes = require('./routes');
const searchService = require('./service');
const searchRepository = require('./repository');
const { parseSearchParams, priorityToInt } = require('./validation');

module.exports = {
    routes,
    searchService,
    searchRepository,
    parseSearchParams,
    priorityToInt,
};
