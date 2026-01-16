'use strict';

/**
 * Users Module
 *
 * This module handles all user-related functionality including:
 * - User listing
 * - Profile management (get, update)
 * - Avatar upload/delete
 * - Password change
 * - API key management
 * - Task summary settings
 * - Today/Sidebar/UI settings
 *
 * Usage:
 *   const usersModule = require('./modules/users');
 *   app.use('/api', usersModule.routes);
 */

const routes = require('./routes');
const usersService = require('./service');
const usersRepository = require('./repository');
const {
    VALID_FREQUENCIES,
    validateFirstDayOfWeek,
    validatePassword,
    validateFrequency,
    validateApiKeyId,
    validateApiKeyName,
    validateExpiresAt,
    validateSidebarSettings,
} = require('./validation');

module.exports = {
    routes,
    usersService,
    usersRepository,
    VALID_FREQUENCIES,
    validateFirstDayOfWeek,
    validatePassword,
    validateFrequency,
    validateApiKeyId,
    validateApiKeyName,
    validateExpiresAt,
    validateSidebarSettings,
};
