'use strict';

const { ValidationError } = require('../../shared/errors');

function validateName(name) {
    if (!name || name.trim() === '') {
        throw new ValidationError('View name is required');
    }
    return name.trim();
}

module.exports = { validateName };
