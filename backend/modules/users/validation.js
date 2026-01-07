'use strict';

const { ValidationError } = require('../../shared/errors');

const VALID_FREQUENCIES = [
    'daily',
    'weekdays',
    'weekly',
    '1h',
    '2h',
    '4h',
    '8h',
    '12h',
];

/**
 * Validate first day of week.
 */
function validateFirstDayOfWeek(value) {
    if (value === undefined) return;
    if (typeof value !== 'number' || value < 0 || value > 6) {
        throw new ValidationError(
            'First day of week must be a number between 0 (Sunday) and 6 (Saturday)',
            'first_day_of_week'
        );
    }
}

/**
 * Validate password.
 */
function validatePassword(password, field = 'password') {
    if (password && password.length < 6) {
        throw new ValidationError(
            'Password must be at least 6 characters',
            field
        );
    }
}

/**
 * Validate task summary frequency.
 */
function validateFrequency(frequency) {
    if (!frequency) {
        throw new ValidationError('Frequency is required.');
    }
    if (!VALID_FREQUENCIES.includes(frequency)) {
        throw new ValidationError('Invalid frequency value.');
    }
    return frequency;
}

/**
 * Validate API key ID.
 */
function validateApiKeyId(id) {
    const tokenId = parseInt(id, 10);
    if (Number.isNaN(tokenId)) {
        throw new ValidationError('Invalid API key id.');
    }
    return tokenId;
}

/**
 * Validate API key name.
 */
function validateApiKeyName(name) {
    if (!name || !name.trim()) {
        throw new ValidationError('API key name is required.');
    }
    return name.trim();
}

/**
 * Validate expires_at date.
 */
function validateExpiresAt(expires_at) {
    if (!expires_at) return null;
    const parsedDate = new Date(expires_at);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new ValidationError('expires_at must be a valid date.');
    }
    return parsedDate;
}

/**
 * Validate sidebar settings.
 */
function validateSidebarSettings(body) {
    const { pinnedViewsOrder } = body;
    if (!Array.isArray(pinnedViewsOrder)) {
        throw new ValidationError('pinnedViewsOrder must be an array');
    }
    return { pinnedViewsOrder };
}

module.exports = {
    VALID_FREQUENCIES,
    validateFirstDayOfWeek,
    validatePassword,
    validateFrequency,
    validateApiKeyId,
    validateApiKeyName,
    validateExpiresAt,
    validateSidebarSettings,
};
