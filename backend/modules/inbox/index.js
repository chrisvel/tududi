'use strict';

/**
 * Inbox Module
 *
 * This module handles all inbox-related functionality including:
 * - CRUD operations for inbox items
 * - Text analysis for inbox content
 * - Pagination support
 *
 * Usage:
 *   const inboxModule = require('./modules/inbox');
 *   app.use('/api', inboxModule.routes);
 */

const routes = require('./routes');
const inboxService = require('./service');
const inboxRepository = require('./repository');
const {
    validateContent,
    validateUid,
    buildTitleFromContent,
} = require('./validation');

module.exports = {
    routes,
    inboxService,
    inboxRepository,
    validateContent,
    validateUid,
    buildTitleFromContent,
};
