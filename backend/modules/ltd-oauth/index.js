'use strict';

// Life-to-Day (T-701, T-702): embedded OAuth 2.1 server for remote MCP.
const config = require('./config');

module.exports = {
    ...config,
    get router() {
        return require('./routes');
    },
    verifyAccessToken: (...args) =>
        require('./verify').verifyAccessToken(...args),
};
