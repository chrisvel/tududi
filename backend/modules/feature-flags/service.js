'use strict';

class FeatureFlagsService {
    /**
     * Get all feature flags.
     */
    getAll() {
        return {
            backups: process.env.FF_ENABLE_BACKUPS === 'true',
            calendar: process.env.FF_ENABLE_CALENDAR === 'true',
            habits: process.env.FF_ENABLE_HABITS === 'true',
        };
    }
}

module.exports = new FeatureFlagsService();
