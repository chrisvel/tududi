'use strict';

const routes = require('./routes');
const dispatcher = require('./dispatcher');
const taskEvents = require('./taskEvents');

taskEvents.register();

module.exports = { routes, dispatcher };
