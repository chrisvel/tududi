'use strict';

const { getConfig } = require('../../config/config');
const { BillingNotConfiguredError } = require('../../shared/errors');
const { buildCatalog, lookupPrice } = require('./providers/priceCatalog');

// The Stripe SDK is only loaded when a hosted instance has a key. Self-hosted
// installs never require it.
let client = null;
let clientKey = null;

function stripeConfig() {
    return getConfig().hosted?.stripe || {};
}

function isBillingConfigured() {
    const config = getConfig();
    return config.hosted?.enabled === true && !!stripeConfig().secretKey;
}

function getStripe() {
    const { secretKey, apiVersion } = stripeConfig();
    if (!isBillingConfigured()) {
        throw new BillingNotConfiguredError();
    }
    if (!client || clientKey !== secretKey) {
        const Stripe = require('stripe');
        client = new Stripe(secretKey, apiVersion ? { apiVersion } : {});
        clientKey = secretKey;
    }
    return client;
}

// Price ids by plan: { pro: { month, year }, team_5: { month, year }, … }.
function configuredPlans() {
    return buildCatalog(stripeConfig().prices || {});
}

function configuredPrices(plan = 'pro') {
    return configuredPlans()[plan] || { month: null, year: null };
}

// Which plan a Stripe price id belongs to.
function planForPrice(priceId) {
    return lookupPrice(configuredPlans(), priceId).plan;
}

module.exports = {
    getStripe,
    isBillingConfigured,
    configuredPlans,
    configuredPrices,
    planForPrice,
    _reset: () => {
        client = null;
        clientKey = null;
    },
};
