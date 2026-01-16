'use strict';

const { AppError } = require('../errors');
const { logError } = require('../../services/logService');

/**
 * Global error handler middleware.
 * Converts errors to consistent JSON responses.
 */
function errorHandler(err, req, res, next) {
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
        console.error(err);
    } else {
        logError('Error:', err);
    }

    // Handle our custom AppError instances
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Handle Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: err.errors.map((e) => e.message).join(', '),
            code: 'VALIDATION_ERROR',
        });
    }

    // Handle Sequelize unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            error: 'A resource with this identifier already exists.',
            code: 'CONFLICT',
        });
    }

    // Handle unknown errors
    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message;

    res.status(statusCode).json({
        error: message,
        code: 'INTERNAL_ERROR',
    });
}

module.exports = errorHandler;
