'use strict';

// One definition of "CalDAV is on" for the routes, the sync scheduler, and
// the flag the UI reads. CALDAV_ENABLED is the older name and still works.
const isCalDAVEnabled = () =>
    process.env.FF_ENABLE_CALDAV === 'true' ||
    process.env.CALDAV_ENABLED === 'true';

class FeatureFlagsService {
    /**
     * Get all feature flags.
     */
    getAll() {
        return {
            backups: process.env.FF_ENABLE_BACKUPS === 'true',
            caldav: isCalDAVEnabled(),
            mcp: process.env.FF_ENABLE_MCP === 'true',
        };
    }
}

const featureFlagsService = new FeatureFlagsService();
featureFlagsService.isCalDAVEnabled = isCalDAVEnabled;

module.exports = featureFlagsService;
