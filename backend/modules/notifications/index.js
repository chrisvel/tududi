'use strict';

const routes = require('./routes');
const notificationsService = require('./service');
const notificationsRepository = require('./repository');

module.exports = {
    routes,
    notificationsService,
    notificationsRepository,
};
