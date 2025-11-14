const { computeTaskMetrics, buildMetricsResponse } = require('../helpers');

async function getTaskMetrics(userId, timezone) {
    const metrics = await computeTaskMetrics(userId, timezone);
    return await buildMetricsResponse(metrics);
}

module.exports = {
    getTaskMetrics,
};
