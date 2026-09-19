'use strict';

const { ValidationError } = require('../../shared/errors');

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const MAX_MEMBERS_PER_REQUEST = 500;

function validateName(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new ValidationError('Group name is required');
    }
    const name = value.trim();
    if (name.length > NAME_MAX_LENGTH) {
        throw new ValidationError(
            `Group name must be at most ${NAME_MAX_LENGTH} characters`
        );
    }
    return name;
}

function validateDescription(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
        throw new ValidationError('Group description must be a string');
    }
    const description = value.trim();
    if (description.length > DESCRIPTION_MAX_LENGTH) {
        throw new ValidationError(
            `Group description must be at most ${DESCRIPTION_MAX_LENGTH} characters`
        );
    }
    return description || null;
}

function validateCreateGroup(body = {}) {
    return {
        name: validateName(body.name),
        description: validateDescription(body.description),
    };
}

function validateUpdateGroup(body = {}) {
    const data = {};
    if (body.name !== undefined) data.name = validateName(body.name);
    if (body.description !== undefined) {
        data.description = validateDescription(body.description);
    }
    if (Object.keys(data).length === 0) {
        throw new ValidationError('Nothing to update');
    }
    return data;
}

function validateMemberIds(body = {}) {
    const ids = body.user_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ValidationError('user_ids must be a non-empty array');
    }
    if (ids.length > MAX_MEMBERS_PER_REQUEST) {
        throw new ValidationError(
            `At most ${MAX_MEMBERS_PER_REQUEST} users can be added at once`
        );
    }
    if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
        throw new ValidationError('user_ids must be positive integers');
    }
    return [...new Set(ids)];
}

function validateUserId(value) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Invalid user id');
    }
    return id;
}

module.exports = {
    validateCreateGroup,
    validateUpdateGroup,
    validateMemberIds,
    validateUserId,
};
