'use strict';

const { ValidationError } = require('../../shared/errors');
const { isValidUid } = require('../../utils/slug-utils');

/**
 * Validates area name.
 * @param {string} name - The name to validate
 * @returns {string} - The sanitized name
 * @throws {ValidationError} - If validation fails
 */
function validateName(name) {
    if (!name || typeof name !== 'string') {
        throw new ValidationError('Area name is required.');
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        throw new ValidationError('Area name is required.');
    }

    return trimmed;
}

/**
 * Validates a UID parameter.
 * @param {string} uid - The UID to validate
 * @throws {ValidationError} - If validation fails
 */
function validateUid(uid) {
    if (!isValidUid(uid)) {
        throw new ValidationError('Invalid UID');
    }
}

module.exports = {
    validateName,
    validateUid,
};
