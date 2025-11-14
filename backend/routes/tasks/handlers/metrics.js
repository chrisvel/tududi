const { computeTaskMetrics, buildMetricsResponse } = require('../helpers');

/**
 * Get task metrics for dashboard
 */
async function getTaskMetrics(userId, timezone, queryType) {
    const metrics = await computeTaskMetrics(userId, timezone);

    const serializationOptions =
        queryType === 'today' ? { preserveOriginalName: true } : {};

    const response = await buildMetricsResponse(
        metrics,
        timezone,
        serializationOptions
    );

    return response;
}

module.exports = {
    getTaskMetrics,
};
