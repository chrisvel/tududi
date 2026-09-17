'use strict';

const { PASSWORD_MIN_LENGTH } = require('./userService');

const { ValidationError } = require('../../shared/errors');
const { assertSafeUrl } = require('../url/ssrfGuard');

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
    if (password && password.length < PASSWORD_MIN_LENGTH) {
        throw new ValidationError(
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
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

const AI_MODEL_MAX_LENGTH = 200;

// ai_base_url is attacker-controlled: any authenticated user can set it, and
// the server then makes outbound requests to it (backend/modules/ai-assistant
// /service.js). Reuse the same SSRF guard the url-preview module uses rather
// than a bare `new URL()` check, or this becomes a way to reach internal
// services (cloud metadata, other containers) from an authenticated account.
async function validateAiSettings({ ai_base_url, ai_model }) {
    if (
        ai_base_url !== undefined &&
        ai_base_url !== null &&
        ai_base_url !== ''
    ) {
        try {
            await assertSafeUrl(ai_base_url);
        } catch {
            throw new ValidationError(
                'Base URL must be a public http(s) URL on the default port (internal/private/loopback addresses are not allowed)',
                'ai_base_url'
            );
        }
    }
    if (ai_model !== undefined && ai_model !== null) {
        if (typeof ai_model !== 'string') {
            throw new ValidationError('Model must be a string', 'ai_model');
        }
        if (ai_model.length > AI_MODEL_MAX_LENGTH) {
            throw new ValidationError(
                `Model must be ${AI_MODEL_MAX_LENGTH} characters or fewer`,
                'ai_model'
            );
        }
    }
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
    validateAiSettings,
};
