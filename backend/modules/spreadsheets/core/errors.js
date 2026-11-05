'use strict';

// Tags an error with a short reason the client translates; the English
// message stays as the fallback for API users and older clients.
function withReason(error, reason) {
    const base = error.toJSON.bind(error);
    error.reason = reason;
    error.toJSON = () => ({ ...base(), reason });
    return error;
}

module.exports = { withReason };
