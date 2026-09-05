'use strict';

const { User } = require('../../models');
const bcrypt = require('bcrypt');
const _ = require('lodash');

/**
 * Creates a user or updates password if user already exists
 * @param {string} email - User email
 * @param {string} password - User password (plain text)
 * @returns {Promise<{user: User, created: boolean}>} User object and creation status
 */
// Creates the user if missing. An existing user's password is only replaced
// when updatePassword is set: the Docker entrypoint runs this on every boot
// and must not keep resetting a password the owner has since changed.
async function createOrUpdateUser(
    email,
    password,
    { updatePassword = false } = {}
) {
    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user, created] = await User.findOrCreate({
        where: { email: normalizedEmail },
        defaults: {
            email: normalizedEmail,
            password_digest: hashedPassword,
        },
    });

    let passwordUpdated = false;
    if (!created && updatePassword) {
        await user.update({ password_digest: hashedPassword });
        passwordUpdated = true;
    }

    return { user, created, passwordUpdated };
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
const PASSWORD_MIN_LENGTH = 8;
const MIN_LENGTH_POLICY_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;

function validatePassword(password) {
    if (typeof password !== 'string' || _.trim(password) === '') return false;
    return password.length >= PASSWORD_MIN_LENGTH;
}

module.exports = {
    PASSWORD_MIN_LENGTH,
    MIN_LENGTH_POLICY_MESSAGE,
    createOrUpdateUser,
    validateEmail,
    validatePassword,
};
