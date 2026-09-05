'use strict';

const routes = require('./routes');
const { webhookHandler } = require('./webhookRoutes');
const billingService = require('./service');

module.exports = { routes, webhookHandler, billingService };
