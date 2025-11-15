const { sequelize } = require('../models');

let queryCount = 0;
let queryStartTime = null;
let queries = [];

const enableQueryLogging = () => {
    sequelize.options.logging = (sql, timing) => {
        queryCount++;
        const timestamp = Date.now() - (queryStartTime || Date.now());
        queries.push({
            num: queryCount,
            sql: sql.substring(0, 300),
            time: timestamp,
        });
        console.log(
            `[Query ${queryCount} @ ${timestamp}ms] ${sql.substring(0, 200)}...`
        );
    };
};

const resetQueryCounter = () => {
    queryCount = 0;
    queryStartTime = Date.now();
    queries = [];
};

const getQueryStats = () => {
    const duration = queryStartTime ? Date.now() - queryStartTime : 0;
    return {
        count: queryCount,
        duration,
        queries,
    };
};

module.exports = {
    enableQueryLogging,
    resetQueryCounter,
    getQueryStats,
};
