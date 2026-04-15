'use strict';

function isPasswordAuthEnabled() {
    return process.env.PASSWORD_AUTH_ENABLED !== 'false';
}

function validateAuthConfiguration() {
    const passwordAuthEnabled = isPasswordAuthEnabled();
    const { isOidcEnabled } = require('../modules/oidc/providerConfig');

    if (!passwordAuthEnabled && !isOidcEnabled()) {
        const { logError } = require('../services/logService');
        logError(
            new Error(
                'WARNING: Both password authentication and OIDC are disabled. Users will not be able to log in!'
            ),
            'Authentication Configuration Warning'
        );
    }

    return {
        passwordAuthEnabled,
        oidcEnabled: isOidcEnabled(),
    };
}

module.exports = {
    isPasswordAuthEnabled,
    validateAuthConfiguration,
};
