'use strict';

// Encrypts small secrets (OIDC client secrets today) before they enter the
// database. Nothing else in the codebase persists a secret outside of
// .env, so this is deliberately narrow: one algorithm, one key-derivation
// path, versioned so a future scheme change doesn't break old rows.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended nonce size for GCM
const VERSION = 'v1';
const HKDF_INFO = Buffer.from('tududi-secret-cipher');

// Prefers a dedicated key so it can be rotated independently of the session
// secret; falls back to deriving one from TUDUDI_SESSION_SECRET (already
// required in hosted mode, see hostedConfig.js) so self-hosters who set that
// get encryption without adding a new required env var. Returns null when
// neither is set, which callers treat as "cannot encrypt".
function deriveKey() {
    const explicit = process.env.TUDUDI_OIDC_SECRET_ENCRYPTION_KEY;
    if (explicit) {
        return crypto.createHash('sha256').update(explicit, 'utf8').digest();
    }

    const sessionSecret = process.env.TUDUDI_SESSION_SECRET;
    if (sessionSecret) {
        const derived = crypto.hkdfSync(
            'sha256',
            Buffer.from(sessionSecret, 'utf8'),
            Buffer.alloc(0),
            HKDF_INFO,
            32
        );
        return Buffer.from(derived);
    }

    return null;
}

function hasKeyMaterial() {
    return deriveKey() !== null;
}

function encrypt(plaintext) {
    const key = deriveKey();
    if (!key) {
        throw new Error(
            'No key material available: set TUDUDI_OIDC_SECRET_ENCRYPTION_KEY or TUDUDI_SESSION_SECRET'
        );
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
        'enc',
        VERSION,
        iv.toString('base64'),
        tag.toString('base64'),
        ciphertext.toString('base64'),
    ].join(':');
}

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith('enc:v1:');
}

function decrypt(value) {
    if (!isEncrypted(value)) {
        // Nothing to decrypt: callers pass this through for plaintext values
        // (e.g. rows written before encryption was required).
        return value;
    }

    const key = deriveKey();
    if (!key) {
        throw new Error(
            'No key material available to decrypt stored secret: set TUDUDI_OIDC_SECRET_ENCRYPTION_KEY or TUDUDI_SESSION_SECRET'
        );
    }

    const [, , ivB64, tagB64, ciphertextB64] = value.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt, isEncrypted, hasKeyMaterial };
