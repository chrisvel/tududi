'use strict';

/**
 * Projects Module
 *
 * This module handles all project-related functionality including:
 * - CRUD operations for projects
 * - Project image uploads
 * - Tag management for projects
 * - Area association
 * - Share count tracking
 *
 * Usage:
 *   const projectsModule = require('./modules/projects');
 *   app.use('/api', projectsModule.routes);
 */

const routes = require('./routes');
const projectsService = require('./service');
const projectsRepository = require('./repository');
const { validateUid, validateName, formatDate } = require('./validation');

module.exports = {
    routes,
    projectsService,
    projectsRepository,
    validateUid,
    validateName,
    formatDate,
};
