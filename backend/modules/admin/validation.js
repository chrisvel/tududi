'use strict';

const { ValidationError } = require('../../shared/errors');

/**
 * Validate user ID parameter.
 */
function validateUserId(id) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed)) {
        throw new ValidationError('Invalid user id');
    }
    return parsed;
}

/**
 * Validate email.
 */
function validateEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) {
        throw new ValidationError('Invalid email');
    }
    return email;
}

/**
 * Validate password.
 */
function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
    }
    return password;
}

/**
 * Validate set-admin-role request body.
 */
function validateSetAdminRole(body) {
    const { user_id, is_admin } = body || {};
    if (!user_id || typeof is_admin !== 'boolean') {
        throw new ValidationError('user_id and is_admin are required');
    }
    return { user_id, is_admin };
}

/**
 * Validate create user request body.
 */
function validateCreateUser(body) {
    const { email, password, name, surname, role } = body || {};
    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }
    validateEmail(email);
    validatePassword(password);
    return { email, password, name, surname, role };
}

/**
 * Validate toggle registration request body.
 */
function validateToggleRegistration(body) {
    const { enabled } = body || {};
    if (typeof enabled !== 'boolean') {
        throw new ValidationError('enabled must be a boolean value');
    }
    return { enabled };
}

module.exports = {
    validateUserId,
    validateEmail,
    validatePassword,
    validateSetAdminRole,
    validateCreateUser,
    validateToggleRegistration,
};
