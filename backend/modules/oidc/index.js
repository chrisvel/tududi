module.exports = {
    routes: require('./routes'),
    service: require('./service'),
    providerConfig: require('./providerConfig'),
    provisioningService: require('./provisioningService'),
    oidcIdentityService: require('./oidcIdentityService'),
    stateManager: require('./stateManager'),
    auditService: require('./auditService'),
};
