'use strict';

const routes = require('./routes');
const peopleService = require('./service');
const peopleRepository = require('./repository');

module.exports = { routes, peopleService, peopleRepository };
