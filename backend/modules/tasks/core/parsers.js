const { Task } = require('../../../models');
const { ValidationError } = require('../../../shared/errors');

function parsePriority(priority) {
    if (priority === undefined) return null;
    return typeof priority === 'string'
        ? Task.getPriorityValue(priority)
        : priority;
}

function parseStatus(status, defaultStatus = Task.STATUS.NOT_STARTED) {
    if (status === undefined) return defaultStatus;
    return typeof status === 'string' ? Task.getStatusValue(status) : status;
}

// A rough task length in minutes; empty values clear it.
function parseEstimatedMinutes(value) {
    if (value === null || value === '' || value === 0) return null;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) {
        throw new ValidationError(
            'estimated_minutes must be a whole number between 5 and 720'
        );
    }
    return minutes;
}

// LTD-PATCH(T-503): a short first step; empty clears it.
function parseStarterStep(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
        throw new ValidationError('starter_step must be text');
    }
    const step = value.trim();
    if (step.length > 500) {
        throw new ValidationError(
            'starter_step must be at most 500 characters'
        );
    }
    return step || null;
}

module.exports = {
    parseStarterStep,
    parsePriority,
    parseStatus,
    parseEstimatedMinutes,
};
