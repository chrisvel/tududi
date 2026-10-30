'use strict';

const routes = require('./routes');
const { webhookHandler } = require('./webhookRoutes');
const billingService = require('./service');
const { payPage, supporterPage } = require('./payPage');

module.exports = {
    routes,
    webhookHandler,
    billingService,
    payPage,
    supporterPage,
};
