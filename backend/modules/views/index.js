'use strict';

const routes = require('./routes');
const viewsService = require('./service');
const viewsRepository = require('./repository');
const { validateName } = require('./validation');

module.exports = {
    routes,
    viewsService,
    viewsRepository,
    validateName,
};
