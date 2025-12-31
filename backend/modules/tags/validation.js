'use strict';

const { ValidationError } = require('../../shared/errors');

const INVALID_CHARS = /[#%&{}\\<>*?/$!'"@+`|=]/;
const MAX_LENGTH = 50;

/**
 * Validates and sanitizes a tag name.
 * @param {string} name - The tag name to validate
 * @returns {string} - The sanitized tag name
 * @throws {ValidationError} - If validation fails
 */
function validateTagName(name) {
    if (!name || typeof name !== 'string') {
        throw new ValidationError('Tag name is required');
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        throw new ValidationError('Tag name cannot be empty');
    }

    if (trimmed.length > MAX_LENGTH) {
        throw new ValidationError(
            `Tag name must be ${MAX_LENGTH} characters or less`
        );
    }

    if (INVALID_CHARS.test(trimmed)) {
        throw new ValidationError(
            'Tag name contains invalid characters. Please avoid: # % & { } \\ < > * ? / $ ! \' " @ + ` | ='
        );
    }

    return trimmed;
}

module.exports = {
    validateTagName,
};
