'use strict';

/**
 * Areas Module
 *
 * This module handles all area-related functionality including:
 * - CRUD operations for areas
 * - Area validation
 *
 * Usage:
 *   const areasModule = require('./modules/areas');
 *   app.use('/api', areasModule.routes);
 */

const routes = require('./routes');
const areasService = require('./service');
const areasRepository = require('./repository');
const { validateName, validateUid } = require('./validation');

module.exports = {
    routes,
    areasService,
    areasRepository,
    validateName,
    validateUid,
};
