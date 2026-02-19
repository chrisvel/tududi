'use strict';

const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const blockList = new net.BlockList();
blockList.addSubnet('127.0.0.0', 8, 'ipv4');
blockList.addSubnet('0.0.0.0', 8, 'ipv4');
blockList.addSubnet('10.0.0.0', 8, 'ipv4');
blockList.addSubnet('172.16.0.0', 12, 'ipv4');
blockList.addSubnet('192.168.0.0', 16, 'ipv4');
blockList.addSubnet('169.254.0.0', 16, 'ipv4');
blockList.addAddress('169.254.169.254', 'ipv4');
blockList.addAddress('::1', 'ipv6');
blockList.addSubnet('fc00::', 7, 'ipv6');
blockList.addSubnet('fe80::', 10, 'ipv6');

const redactUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return 'invalid-url';
    }
};

const isBlockedAddress = (address) => {
    const family = net.isIP(address);
    if (!family) {
        return false;
    }

    if (family === 4) {
        return blockList.check(address, 'ipv4');
    }

    if (address.startsWith('::ffff:')) {
        const mapped = address.replace('::ffff:', '');
        if (net.isIP(mapped) === 4) {
            return blockList.check(mapped, 'ipv4');
        }
    }

    return blockList.check(address, 'ipv6');
};

const assertHostnameSafe = async (hostname) => {
    const addresses = await dns.lookup(hostname, {
        all: true,
        verbatim: true,
    });

    if (!addresses || addresses.length === 0) {
        throw new Error('DNS lookup failed');
    }

    const blocked = addresses.some(({ address }) => isBlockedAddress(address));
    if (blocked) {
        throw new Error('Blocked address');
    }

    return addresses[0];
};

const createSafeLookup = () => (hostname, options, callback) => {
    dns.lookup(
        hostname,
        {
            all: true,
            verbatim: true,
        },
        (error, addresses) => {
            if (error) {
                callback(error);
                return;
            }

            if (!addresses || addresses.length === 0) {
                callback(new Error('DNS lookup failed'));
                return;
            }

            if (addresses.some(({ address }) => isBlockedAddress(address))) {
                callback(new Error('Blocked address'));
                return;
            }

            callback(null, addresses[0].address, addresses[0].family);
        }
    );
};

const validateUrl = async (rawUrl) => {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { ok: false, error: 'Invalid URL.' };
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        return { ok: false, error: 'Unsupported URL protocol.' };
    }

    if (!parsed.hostname) {
        return { ok: false, error: 'Invalid URL host.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return { ok: false, error: 'URL host is blocked.' };
    }

    if (net.isIP(parsed.hostname)) {
        if (isBlockedAddress(parsed.hostname)) {
            return { ok: false, error: 'URL host is blocked.' };
        }
        return { ok: true, url: parsed };
    }

    try {
        await assertHostnameSafe(parsed.hostname);
    } catch {
        return { ok: false, error: 'URL host is blocked.' };
    }

    return { ok: true, url: parsed };
};

const fetchWithRedirects = (urlObj, options, redirectCount) =>
    new Promise((resolve) => {
        let settled = false;
        let req = null;
        let globalTimeout = null;
        const finalize = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            if (globalTimeout) {
                clearTimeout(globalTimeout);
            }
            resolve(result);
        };

        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        const headers = {
            Accept: 'text/calendar, text/plain, */*',
            'User-Agent': 'tududi-ics-fetcher',
        };

        if (options.etag) {
            headers['If-None-Match'] = options.etag;
        }
        if (options.lastModified) {
            headers['If-Modified-Since'] = options.lastModified;
        }

        const requestOptions = {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: `${urlObj.pathname}${urlObj.search || ''}`,
            method: 'GET',
            headers,
            lookup: createSafeLookup(),
        };

        req = client.request(requestOptions, async (res) => {
            const statusCode = res.statusCode || 0;
            const etag = res.headers.etag;
            const lastModified = res.headers['last-modified'];

            if (REDIRECT_STATUS_CODES.has(statusCode) && res.headers.location) {
                res.resume();

                if (redirectCount >= options.maxRedirects) {
                    finalize({
                        success: false,
                        error: 'Too many redirects.',
                        statusCode,
                        etag,
                        lastModified,
                    });
                    return;
                }

                const redirectUrl = new URL(res.headers.location, urlObj);
                const validation = await validateUrl(redirectUrl.href);
                if (!validation.ok) {
                    finalize({
                        success: false,
                        error: validation.error,
                        statusCode,
                        etag,
                        lastModified,
                    });
                    return;
                }

                const nextResult = await fetchWithRedirects(
                    validation.url,
                    options,
                    redirectCount + 1
                );
                finalize(nextResult);
                return;
            }

            if (statusCode === 304) {
                res.resume();
                finalize({
                    success: true,
                    statusCode,
                    etag,
                    lastModified,
                });
                return;
            }

            if (statusCode < 200 || statusCode >= 300) {
                res.resume();
                finalize({
                    success: false,
                    error: 'Request failed.',
                    statusCode,
                    etag,
                    lastModified,
                });
                return;
            }

            const chunks = [];
            let receivedBytes = 0;

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (receivedBytes > options.maxBodyBytes) {
                    res.destroy();
                    finalize({
                        success: false,
                        error: 'Response exceeds maximum size.',
                        statusCode,
                        etag,
                        lastModified,
                    });
                    return;
                }
                chunks.push(chunk);
            });

            res.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                finalize({
                    success: true,
                    data,
                    statusCode,
                    etag,
                    lastModified,
                });
            });

            res.on('error', () => {
                finalize({
                    success: false,
                    error: 'Response error.',
                    statusCode,
                    etag,
                    lastModified,
                });
            });
        });

        req.setTimeout(options.timeoutMs, () => {
            req.destroy(new Error('Request timeout'));
        });

        req.on('error', () => {
            finalize({
                success: false,
                error: `Request failed for ${redactUrl(urlObj.href)}.`,
            });
        });

        globalTimeout = setTimeout(() => {
            req.destroy(new Error('Request timeout'));
            finalize({
                success: false,
                error: 'Request timed out.',
            });
        }, options.timeoutMs);

        req.end();
    });

const fetchIcs = async (rawUrl, options = {}) => {
    if (!rawUrl) {
        return { success: false, error: 'URL is required.' };
    }

    const validation = await validateUrl(rawUrl);
    if (!validation.ok) {
        return { success: false, error: validation.error };
    }

    const resolvedOptions = {
        etag: options.etag,
        lastModified: options.lastModified,
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        maxRedirects: options.maxRedirects || MAX_REDIRECTS,
        maxBodyBytes: options.maxBodyBytes || MAX_BODY_BYTES,
    };

    return fetchWithRedirects(validation.url, resolvedOptions, 0);
};

module.exports = {
    fetchIcs,
};
