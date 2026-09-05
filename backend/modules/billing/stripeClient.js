'use strict';

const { getConfig } = require('../../config/config');
const { BillingNotConfiguredError } = require('../../shared/errors');

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

function configuredPrices() {
    const prices = stripeConfig().prices || {};
    return {
        month: prices.proMonthly || null,
        year: prices.proAnnual || null,
    };
}

// Which plan a Stripe price id belongs to. One paid tier for now.
function planForPrice(priceId) {
    const prices = configuredPrices();
    if (priceId && (priceId === prices.month || priceId === prices.year)) {
        return 'pro';
    }
    return null;
}

module.exports = {
    getStripe,
    isBillingConfigured,
    configuredPrices,
    planForPrice,
    _reset: () => {
        client = null;
        clientKey = null;
    },
};
