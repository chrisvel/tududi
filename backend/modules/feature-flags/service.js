'use strict';

class FeatureFlagsService {
    /**
     * Get all feature flags.
     */
    getAll() {
        return {
            backups: process.env.FF_ENABLE_BACKUPS === 'true',
            calendar: process.env.FF_ENABLE_CALENDAR === 'true',
            caldav:
                process.env.FF_ENABLE_CALDAV === 'true' ||
                process.env.CALDAV_ENABLED === 'true',
            habits: process.env.FF_ENABLE_HABITS === 'true',
            mcp: process.env.FF_ENABLE_MCP === 'true',
        };
    }
}

module.exports = new FeatureFlagsService();
