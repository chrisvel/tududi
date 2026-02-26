'use strict';

/**
 * Matrices Module
 *
 * Handles 2×2 prioritization matrices: CRUD, task assignment, and browsing.
 *
 * Usage:
 *   const matricesModule = require('./modules/matrices');
 *   app.use('/api', matricesModule.routes);
 */

const routes = require('./routes');

module.exports = { routes };
