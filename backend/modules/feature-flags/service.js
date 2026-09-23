'use strict';

// CalDAV, backups and MCP are always on; this stays a function (rather than
// a plain `true`) since the sync scheduler and CalDAV routes both call it.
const isCalDAVEnabled = () => true;

class FeatureFlagsService {
    /**
     * Get all feature flags.
     */
    getAll() {
        const { getConfig } = require('../../config/config');
        const hosted = getConfig().hosted || {};
        return {
            backups: true,
            caldav: isCalDAVEnabled(),
            mcp: true,
            hosted: hosted.enabled === true,
            billing: require('../billing/providers').isBillingConfigured(),
        };
    }
}

const featureFlagsService = new FeatureFlagsService();
featureFlagsService.isCalDAVEnabled = isCalDAVEnabled;

module.exports = featureFlagsService;
