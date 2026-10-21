'use strict';

class FeatureFlagsService {
    /**
     * Get all feature flags.
     */
    getAll() {
        const { getConfig } = require('../../config/config');
        const hosted = getConfig().hosted || {};
        return {
            hosted: hosted.enabled === true,
            billing: require('../billing/providers').isBillingConfigured(),
            telegram: getConfig().telegramEnabled === true,
        };
    }
}

const featureFlagsService = new FeatureFlagsService();

module.exports = featureFlagsService;
