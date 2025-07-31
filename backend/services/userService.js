'use strict';

const { User } = require('../models');
const bcrypt = require('bcrypt');
const _ = require('lodash');

/**
 * Creates a user or updates password if user already exists
 * @param {string} email - User email
 * @param {string} password - User password (plain text)
 * @returns {Promise<{user: User, created: boolean}>} User object and creation status
 */
async function createOrUpdateUser(email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user, created] = await User.findOrCreate({
        where: { email },
        defaults: {
            email,
            password_digest: hashedPassword,
        },
    });

    // User exists, update password
    if (!created) {
        await user.update({ password_digest: hashedPassword });
    }

    return { user, created };
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
    if (_.trim(email) === '') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Check for common invalid patterns
    return !(
        !email.includes('@') ||
        !email.includes('.') ||
        email.includes('@@') ||
        email.includes(' ') ||
        email.startsWith('@') ||
        email.endsWith('@') ||
        email.endsWith('.') ||
        email.includes('@.') ||
        email.includes('.@') ||
        !emailRegex.test(email)
    );
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid
 */
function validatePassword(password) {
    if (_.trim(password) === '') return false;
    return password.length >= 6;
}

module.exports = {
    createOrUpdateUser,
    validateEmail,
    validatePassword,
};
