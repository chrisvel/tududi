'use strict';

const routes = require('./routes');
const groupsService = require('./service');
const groupsRepository = require('./repository');

module.exports = { routes, groupsService, groupsRepository };
