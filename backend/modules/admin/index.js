'use strict';

/**
 * Admin Module
 *
 * This module handles all admin-related functionality including:
 * - User management (CRUD operations)
 * - Role management (admin/user)
 * - Registration toggle
 *
 * Usage:
 *   const adminModule = require('./modules/admin');
 *   app.use('/api', adminModule.routes);
 */

const routes = require('./routes');
const adminService = require('./service');
const adminRepository = require('./repository');
const {
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
} = require('./validation');

module.exports = {
    routes,
    adminService,
    adminRepository,
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
};
