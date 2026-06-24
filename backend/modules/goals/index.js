'use strict';

const routes = require('./routes');
const goalsService = require('./service');
const goalsRepository = require('./repository');

module.exports = { routes, goalsService, goalsRepository };
