'use strict';

const { ValidationError } = require('../../shared/errors');
const { DATE_FILTERS, TASK_STATUS_FILTERS } = require('../search/validation');

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

function validateDateFilter(value, message) {
    if (!value) return null;
    if (!DATE_FILTERS.includes(value)) {
        throw new ValidationError(message);
    }
    return value;
}

function validateDue(due) {
    return validateDateFilter(due, 'Invalid due date filter');
}

function validateDefer(defer) {
    return validateDateFilter(defer, 'Invalid defer date filter');
}

module.exports = {
    validateName,
    validateTaskStatus,
    validateDue,
    validateDefer,
};
