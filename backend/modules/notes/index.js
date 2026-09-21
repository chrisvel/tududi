'use strict';

/**
 * Notes Module
 *
 * This module handles all note-related functionality including:
 * - CRUD operations for notes
 * - Tag management for notes
 * - Project association with permission checks
 * - Note validation
 * - Public sharing by link (owner-controlled, revocable)
 *
 * Usage:
 *   const notesModule = require('./modules/notes');
 *   app.use('/api', notesModule.routes);
 */

const routes = require('./routes');
const publicRoutes = require('./publicRoutes');
const notesService = require('./service');
const notesRepository = require('./repository');
const { validateUid, validateTitle } = require('./validation');

module.exports = {
    routes,
    publicRoutes,
    notesService,
    notesRepository,
    validateUid,
    validateTitle,
};
