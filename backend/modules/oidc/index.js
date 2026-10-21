module.exports = {
    routes: require('./routes'),
    service: require('./service'),
    providerConfig: require('./providerConfig'),
    appleProvider: require('./appleProvider'),
    provisioningService: require('./provisioningService'),
    oidcIdentityService: require('./oidcIdentityService'),
    stateManager: require('./stateManager'),
    auditService: require('./auditService'),
};
