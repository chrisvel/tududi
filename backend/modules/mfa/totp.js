'use strict';

const crypto = require('crypto');

// Time-based one-time codes (RFC 6238) as authenticator apps make them:
// HMAC-SHA1, 6 digits, a new code every 30 seconds. Small enough to keep in
// the codebase rather than pull in a library for it.

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(text) {
    const clean = String(text)
        .toUpperCase()
        .replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of clean) {
        const index = BASE32.indexOf(char);
        if (index === -1) throw new Error('Invalid base32 secret');
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

// 160 random bits, the size RFC 4226 recommends for SHA-1.
function generateSecret() {
    return base32Encode(crypto.randomBytes(20));
}

function stepAt(timeMs) {
    return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

function codeAt(secret, step, digits = DIGITS) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = crypto
        .createHmac('sha1', base32Decode(secret))
        .update(counter)
        .digest();
    const offset = hmac[hmac.length - 1] & 15;
    const number = hmac.readUInt32BE(offset) & 0x7fffffff;
    return String(number % 10 ** digits).padStart(digits, '0');
}

// The time step a code belongs to, or null. Accepts one step either side
// for phone clocks that drift, and never a step at or before `afterStep`,
// so a code that was used once cannot be used again.
function verifyCode(
    secret,
    code,
    { now = Date.now(), window = 1, afterStep = null } = {}
) {
    const clean = String(code || '').replace(/\s/g, '');
    if (!new RegExp(`^\\d{${DIGITS}}$`).test(clean)) return null;
    const current = stepAt(now);
    const given = Buffer.from(clean);
    for (let step = current - window; step <= current + window; step++) {
        if (afterStep !== null && step <= afterStep) continue;
        const expected = Buffer.from(codeAt(secret, step));
        if (crypto.timingSafeEqual(given, expected)) return step;
    }
    return null;
}

// What an authenticator app reads from the QR code.
function otpauthUri(secret, { issuer, account }) {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: String(DIGITS),
        period: String(STEP_SECONDS),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = {
    base32Encode,
    base32Decode,
    generateSecret,
    stepAt,
    codeAt,
    verifyCode,
    otpauthUri,
};
