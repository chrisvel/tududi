'use strict';

const { ValidationError } = require('../../shared/errors');
const { isValidUid, extractUidFromSlug } = require('../../utils/slug-utils');

/**
 * Validate project UID.
 */
function validateUid(uidOrSlug) {
    if (!uidOrSlug || typeof uidOrSlug !== 'string') {
        throw new ValidationError('Project UID is required.');
    }

    const uid = extractUidFromSlug(uidOrSlug);
    if (!uid || !isValidUid(uid)) {
        throw new ValidationError('Invalid project UID format.');
    }

    return uid;
}

/**
 * Validate project name.
 */
function validateName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ValidationError('Project name is required');
    }
    return name.trim();
}

/**
 * Safely format dates.
 */
function formatDate(date) {
    if (!date) return null;
    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return null;
        return dateObj.toISOString();
    } catch (error) {
        return null;
    }
}

module.exports = {
    validateUid,
    validateName,
    formatDate,
};
