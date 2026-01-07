'use strict';

const { ValidationError } = require('../../shared/errors');
const { isValidUid } = require('../../utils/slug-utils');

const TITLE_MAX_LENGTH = 120;

/**
 * Validates and sanitizes inbox item content.
 * @param {string} content - The content to validate
 * @returns {string} - The sanitized content
 * @throws {ValidationError} - If validation fails
 */
function validateContent(content) {
    if (!content || typeof content !== 'string') {
        throw new ValidationError('Content is required');
    }

    const trimmed = content.trim();

    if (trimmed.length === 0) {
        throw new ValidationError('Content cannot be empty');
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

/**
 * Builds a title from content (truncated if necessary).
 * @param {string} content - The content to build title from
 * @returns {string} - The generated title
 */
function buildTitleFromContent(content) {
    const normalized = content.trim();
    if (normalized.length <= TITLE_MAX_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, TITLE_MAX_LENGTH).trim()}...`;
}

/**
 * Validates source field.
 * @param {string|undefined} source - The source to validate
 * @returns {string} - The validated source (defaults to 'manual')
 */
function validateSource(source) {
    if (!source || typeof source !== 'string' || !source.trim()) {
        return 'manual';
    }
    return source.trim();
}

module.exports = {
    validateContent,
    validateUid,
    buildTitleFromContent,
    validateSource,
    TITLE_MAX_LENGTH,
};
