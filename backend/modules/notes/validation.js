'use strict';

const { ValidationError } = require('../../shared/errors');
const { isValidUid } = require('../../utils/slug-utils');

/**
 * Validate a note UID.
 * @param {string} uid - The UID to validate.
 * @returns {string} The validated UID.
 * @throws {ValidationError} If the UID is invalid.
 */
function validateUid(uid) {
    if (!uid || typeof uid !== 'string') {
        throw new ValidationError('Note UID is required.');
    }

    const trimmedUid = uid.trim();
    if (!trimmedUid) {
        throw new ValidationError('Note UID cannot be empty.');
    }

    if (!isValidUid(trimmedUid)) {
        throw new ValidationError('Invalid note UID format.');
    }

    return trimmedUid;
}

/**
 * Validate note title.
 * @param {string} title - The title to validate.
 * @returns {string} The validated title.
 * @throws {ValidationError} If the title is invalid.
 */
function validateTitle(title) {
    if (title !== undefined && title !== null) {
        if (typeof title !== 'string') {
            throw new ValidationError('Note title must be a string.');
        }
    }
    return title;
}

module.exports = {
    validateUid,
    validateTitle,
};
