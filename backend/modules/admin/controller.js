'use strict';

const adminService = require('./service');

/**
 * Get requester ID from request.
 */
function getRequesterId(req) {
    return req.currentUser?.id || req.session?.userId;
}

/**
 * Admin controller - handles HTTP requests/responses.
 */
const adminController = {
    /**
     * POST /api/admin/set-admin-role
     * Set admin role for a user.
     */
    async setAdminRole(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            const result = await adminService.setAdminRole(
                requesterId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/admin/users
     * List all users with roles.
     */
    async listUsers(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            const users = await adminService.listUsers(requesterId);
            res.json(users);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/admin/users
     * Create a new user.
     */
    async createUser(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            const user = await adminService.createUser(requesterId, req.body);
            res.status(201).json(user);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /api/admin/users/:id
     * Update a user.
     */
    async updateUser(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            const user = await adminService.updateUser(
                requesterId,
                req.params.id,
                req.body
            );
            res.json(user);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/admin/users/:id
     * Delete a user.
     */
    async deleteUser(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            await adminService.deleteUser(requesterId, req.params.id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/admin/toggle-registration
     * Toggle registration setting.
     */
    async toggleRegistration(req, res, next) {
        try {
            const requesterId = getRequesterId(req);
            const result = await adminService.toggleRegistration(
                requesterId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = adminController;
