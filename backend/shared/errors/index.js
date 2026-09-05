'use strict';

const AppError = require('./AppError');

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

// 402: the action is fine, the plan is not. `details` lets the client show
// which limit was hit and what the current plan is.
class PlanLimitError extends AppError {
    constructor(resource, limit, current, plan) {
        super(
            `Your ${plan} plan allows ${limit} ${resource === 'storage' ? 'bytes of storage' : resource + 's'}`,
            402,
            'PLAN_LIMIT_REACHED'
        );
        this.details = { resource, limit, current, plan };
    }

    toJSON() {
        return { ...super.toJSON(), details: this.details };
    }
}

class FeatureNotInPlanError extends AppError {
    constructor(feature, plan) {
        super(
            `The ${feature} feature is not included in your ${plan} plan`,
            402,
            'FEATURE_NOT_IN_PLAN'
        );
        this.details = { feature, plan };
    }

    toJSON() {
        return { ...super.toJSON(), details: this.details };
    }
}

class BillingNotConfiguredError extends AppError {
    constructor(message = 'Billing is not configured on this instance') {
        super(message, 503, 'BILLING_NOT_CONFIGURED');
    }
}

class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503, 'SERVICE_UNAVAILABLE');
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    ForbiddenError,
    ServiceUnavailableError,
    PlanLimitError,
    FeatureNotInPlanError,
    BillingNotConfiguredError,
};
