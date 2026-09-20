'use strict';

// Errors whose message is safe to show on the login page. Anything else that
// goes wrong during the OIDC flow (discovery failures, IdP error descriptions,
// database errors) is logged and reported to the user as a generic failure,
// so the callback URL cannot be used to put arbitrary text on the login page.
class OidcUserError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OidcUserError';
    }
}

const GENERIC_AUTH_ERROR = 'Authentication failed. Please try again.';

function toUserMessage(error, fallback = GENERIC_AUTH_ERROR) {
    return error instanceof OidcUserError ? error.message : fallback;
}

module.exports = { OidcUserError, GENERIC_AUTH_ERROR, toUserMessage };
