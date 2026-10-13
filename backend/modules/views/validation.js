'use strict';

const { ValidationError } = require('../../shared/errors');
const { TASK_STATUS_FILTERS } = require('../search/validation');

function validateName(name) {
    if (!name || name.trim() === '') {
        throw new ValidationError('View name is required');
    }
    return name.trim();
}

function validateTaskStatus(taskStatus) {
    if (!taskStatus) return null;
    if (!Object.keys(TASK_STATUS_FILTERS).includes(taskStatus)) {
        throw new ValidationError('Invalid task status');
    }
    return taskStatus;
}

module.exports = { validateName, validateTaskStatus };
