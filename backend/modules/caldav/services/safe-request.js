const axios = require('axios');
const dns = require('dns');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { AppError } = require('../../../shared/errors');
const { getConfig } = require('../../../config/config');
const {
    UnsafeUrlError,
    assertPublicHostname,
    isPrivateOrReservedIp,
} = require('../../url/ssrfGuard');

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PRIVATE_ADDRESS_MESSAGE =
    'Cannot connect to private, local, or internal network addresses';

const allowPrivateHosts = () => !!getConfig().caldav?.allowPrivateHosts;

// A remote calendar URL is user input that drives a server-side request, so
// it is checked before every request (not only when it is saved) and again
// for every redirect hop. Public hostnames are resolved and every address must
// be public; IP literals are checked directly.
async function assertSafeCalDavUrl(urlLike, { requireHttps = false } = {}) {
    let parsed;
    try {
        parsed = new URL(urlLike);
    } catch {
        throw new AppError('Invalid URL format', 400);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new AppError('Only HTTP and HTTPS protocols are allowed', 400);
    }

    if (allowPrivateHosts()) {
        return parsed;
    }

    if (requireHttps && parsed.protocol !== 'https:') {
        throw new AppError(
            'CalDAV servers must use HTTPS so credentials are not sent in clear text',
            400
        );
    }

    try {
        await assertPublicHostname(parsed.hostname);
    } catch (error) {
        if (error instanceof UnsafeUrlError) {
            throw new AppError(PRIVATE_ADDRESS_MESSAGE, 400);
        }
        throw error;
    }

    return parsed;
}

// Resolves at connect time and refuses private addresses, which closes the
// gap between the check above and the socket being opened (DNS rebinding).
function guardedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    } else if (typeof options === 'number') {
        options = { family: options };
    }

    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error);

        if (
            !allowPrivateHosts() &&
            addresses.some(({ address }) => isPrivateOrReservedIp(address))
        ) {
            return callback(new AppError(PRIVATE_ADDRESS_MESSAGE, 400));
        }

        if (options && options.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
    });
}

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

function withoutCredentials(config) {
    const next = { ...config };
    delete next.auth;
    if (next.headers) {
        next.headers = Object.fromEntries(
            Object.entries(next.headers).filter(
                ([name]) => name.toLowerCase() !== 'authorization'
            )
        );
    }
    return next;
}

// Drop-in replacement for axios(config) for remote CalDAV servers. Redirects
// are followed by hand so each hop is validated, and credentials are not
// forwarded to a different origin.
async function safeRequest(config, { requireHttps = false } = {}) {
    let requestConfig = { ...config };
    let url = config.url;
    const originalOrigin = new URL(url).origin;
    const callerValidateStatus =
        config.validateStatus || ((status) => status >= 200 && status < 300);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertSafeCalDavUrl(url, { requireHttps });

        const response = await axios({
            ...requestConfig,
            url,
            maxRedirects: 0,
            httpAgent,
            httpsAgent,
            validateStatus: (status) =>
                REDIRECT_STATUSES.has(status) || callerValidateStatus(status),
        });

        if (!REDIRECT_STATUSES.has(response.status)) {
            return response;
        }

        const location = response.headers?.location;
        if (!location) {
            throw new AppError(
                'Remote CalDAV server sent a redirect without a location',
                502
            );
        }

        const next = new URL(location, url);
        if (next.origin !== originalOrigin) {
            requestConfig = withoutCredentials(requestConfig);
        }

        const method = (requestConfig.method || 'GET').toUpperCase();
        if (
            response.status === 303 ||
            (['301', '302'].includes(String(response.status)) &&
                method === 'POST')
        ) {
            requestConfig = { ...requestConfig, method: 'GET' };
            delete requestConfig.data;
        }

        url = next.href;
    }

    throw new AppError('Remote CalDAV server redirected too many times', 502);
}

module.exports = {
    assertSafeCalDavUrl,
    safeRequest,
    guardedLookup,
};
