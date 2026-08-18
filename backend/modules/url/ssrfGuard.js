'use strict';

const dns = require('dns');
const net = require('net');

class UnsafeUrlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnsafeUrlError';
    }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

// Private, loopback, link-local, and other non-routable IPv4 ranges that
// must never be reachable via a user-supplied URL (RFC 1918, RFC 5735,
// RFC 6598, cloud metadata endpoints, etc).
const PRIVATE_IPV4_RANGES = [
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.0.0.0/24',
    '192.0.2.0/24',
    '192.168.0.0/16',
    '198.18.0.0/15',
    '198.51.100.0/24',
    '203.0.113.0/24',
    '224.0.0.0/4',
    '240.0.0.0/4',
];

function ipv4ToLong(ip) {
    return (
        ip
            .split('.')
            .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
    );
}

function isIpv4InCidr(ip, cidr) {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipv4ToLong(ip) & mask) === (ipv4ToLong(range) & mask);
}

function isPrivateIpv4(ip) {
    return PRIVATE_IPV4_RANGES.some((cidr) => isIpv4InCidr(ip, cidr));
}

// Expands a colon-separated IPv6 address (with optional "::" compression)
// into its 8 constituent 16-bit groups, or null if malformed.
function expandIpv6Groups(address) {
    const parts = address.split('::');
    if (parts.length > 2) {
        return null;
    }

    const parseGroups = (segment) => (segment === '' ? [] : segment.split(':'));

    if (parts.length === 1) {
        const groups = parseGroups(parts[0]);
        return groups.length === 8 ? groups.map((g) => parseInt(g, 16)) : null;
    }

    const head = parseGroups(parts[0]);
    const tail = parseGroups(parts[1]);
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
        return null;
    }
    return [...head, ...Array(missing).fill('0'), ...tail].map((g) =>
        parseInt(g, 16)
    );
}

// Pulls the embedded IPv4 address out of an IPv4-mapped IPv6 address
// (::ffff:a.b.c.d), whichever textual form it's written in. The WHATWG URL
// parser normalizes these to pure hex groups (::ffff:127.0.0.1 becomes
// ::ffff:7f00:1) rather than keeping the dotted form, so both must be
// checked or that normalized form slips past the guard undetected.
function extractEmbeddedIpv4(normalized) {
    const dottedMatch = normalized.match(
        /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/
    );
    if (dottedMatch) {
        return dottedMatch[1];
    }

    const groups = expandIpv6Groups(normalized);
    if (!groups || groups[5] !== 0xffff) {
        return null;
    }
    if ([0, 1, 2, 3, 4].some((i) => groups[i] !== 0)) {
        return null;
    }

    const high = groups[6];
    const low = groups[7];
    return [
        (high >> 8) & 0xff,
        high & 0xff,
        (low >> 8) & 0xff,
        low & 0xff,
    ].join('.');
}

function isPrivateIpv6(ip) {
    const normalized = ip.toLowerCase();

    if (normalized === '::1' || normalized === '::') {
        return true;
    }

    const embeddedIpv4 = extractEmbeddedIpv4(normalized);
    if (embeddedIpv4) {
        return isPrivateIpv4(embeddedIpv4);
    }

    // Deprecated "IPv4-compatible" addresses (the ::/96 range, written
    // ::a.b.c.d - e.g. ::127.0.0.1 normalizes to ::7f00:1) carry no ffff
    // marker to key off, unlike the mapped form above. The whole range is
    // non-routable regardless of the embedded value, so block it outright
    // rather than trying to special-case a "public-looking" embedded IPv4.
    const groups = expandIpv6Groups(normalized);
    if (groups && [0, 1, 2, 3, 4, 5].every((i) => groups[i] === 0)) {
        return true;
    }

    // Unique local addresses fc00::/7
    if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) {
        return true;
    }

    // Link-local fe80::/10
    if (/^fe[89ab][0-9a-f]:/.test(normalized)) {
        return true;
    }

    return false;
}

function isPrivateOrReservedIp(ip) {
    if (net.isIPv4(ip)) {
        return isPrivateIpv4(ip);
    }
    if (net.isIPv6(ip)) {
        return isPrivateIpv6(ip);
    }
    // Not a recognizable IP - fail closed.
    return true;
}

async function assertPublicHostname(hostname) {
    // URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]"), which
    // net.isIP() does not recognize - strip them before checking, otherwise
    // the literal falls through to the DNS-lookup branch below.
    const bareHostname =
        hostname.startsWith('[') && hostname.endsWith(']')
            ? hostname.slice(1, -1)
            : hostname;

    // IP literal - no DNS resolution needed, and nothing to rebind.
    if (net.isIP(bareHostname)) {
        if (isPrivateOrReservedIp(bareHostname)) {
            throw new UnsafeUrlError(
                `Refusing to fetch private/reserved address: ${bareHostname}`
            );
        }
        return;
    }

    let addresses;
    try {
        addresses = await dns.promises.lookup(hostname, { all: true });
    } catch {
        throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
    }

    if (!addresses || addresses.length === 0) {
        throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
    }

    for (const { address } of addresses) {
        if (isPrivateOrReservedIp(address)) {
            throw new UnsafeUrlError(
                `Refusing to fetch private/reserved address: ${address}`
            );
        }
    }
}

// Validates a URL is safe to fetch server-side: http(s) only, standard
// ports only, and resolves to a public (non-private/reserved) address.
// Must be called again on every redirect hop, not just the initial URL.
async function assertSafeUrl(urlLike) {
    const parsed = typeof urlLike === 'string' ? new URL(urlLike) : urlLike;

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new UnsafeUrlError(`Unsupported protocol: ${parsed.protocol}`);
    }

    if (!ALLOWED_PORTS.has(parsed.port)) {
        throw new UnsafeUrlError(`Unsupported port: ${parsed.port}`);
    }

    await assertPublicHostname(parsed.hostname);

    return parsed;
}

module.exports = {
    UnsafeUrlError,
    assertSafeUrl,
    isPrivateOrReservedIp,
};
