'use strict';

/**
 * Comments Module
 *
 * Comments on tasks, with @mentions that notify the mentioned person.
 *
 * Usage:
 *   const commentsModule = require('./modules/comments');
 *   app.use('/api', commentsModule.routes);
 */

const routes = require('./routes');
const commentsService = require('./service');
const commentsRepository = require('./repository');

module.exports = {
    routes,
    commentsService,
    commentsRepository,
};
