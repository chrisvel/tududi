'use strict';

const { ValidationError } = require('../../shared/errors');

/**
 * Validate matrix name.
 */
function validateName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ValidationError("Validation error: 'name' is required.");
    }
    if (name.trim().length > 255) {
        throw new ValidationError(
            'Matrix name must be 255 characters or less.'
        );
    }
    return name.trim();
}

/**
 * Validate axis label.
 */
function validateAxisLabel(label, fieldName) {
    if (label !== undefined && label !== null) {
        if (typeof label !== 'string') {
            throw new ValidationError(`${fieldName} must be a string.`);
        }
        if (label.length > 100) {
            throw new ValidationError(
                `${fieldName} must be 100 characters or less.`
            );
        }
    }
}

/**
 * Validate quadrant_index.
 */
function validateQuadrantIndex(quadrantIndex) {
    if (
        quadrantIndex === undefined ||
        quadrantIndex === null ||
        !Number.isInteger(quadrantIndex) ||
        quadrantIndex < 0 ||
        quadrantIndex > 3
    ) {
        throw new ValidationError(
            'Invalid quadrant_index. Must be an integer between 0 and 3.'
        );
    }
    return quadrantIndex;
}

/**
 * Validate position.
 */
function validatePosition(position) {
    if (position !== undefined && position !== null) {
        if (!Number.isInteger(position) || position < 0) {
            throw new ValidationError(
                'Position must be a non-negative integer.'
            );
        }
    }
    return position || 0;
}

module.exports = {
    validateName,
    validateAxisLabel,
    validateQuadrantIndex,
    validatePosition,
};
