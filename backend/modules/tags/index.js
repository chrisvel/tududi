'use strict';

/**
 * Tags Module
 *
 * This module handles all tag-related functionality including:
 * - CRUD operations for tags
 * - Tag validation
 * - Tag associations with tasks, notes, and projects
 *
 * Usage:
 *   const tagsModule = require('./modules/tags');
 *   app.use('/api', tagsModule.routes);
 */

const routes = require('./routes');
const tagsService = require('./service');
const tagsRepository = require('./repository');
const { validateTagName } = require('./validation');

module.exports = {
    routes,
    tagsService,
    tagsRepository,
    validateTagName,
};
