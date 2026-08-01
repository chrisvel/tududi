'use strict';

const { ValidationError } = require('../../../shared/errors');
const { isValidUid, extractUidFromSlug } = require('../../../utils/slug-utils');

function validateUid(uidOrSlug) {
    if (!uidOrSlug || typeof uidOrSlug !== 'string') {
        throw new ValidationError('Template UID is required.');
    }
    const uid = extractUidFromSlug(uidOrSlug);
    if (!uid || !isValidUid(uid)) {
        throw new ValidationError('Invalid template UID format.');
    }
    return uid;
}

function validateName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ValidationError('Template name is required');
    }
    return name.trim();
}

module.exports = { validateUid, validateName };
