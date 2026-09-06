const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { ApiToken } = require('../../models');

const TOKEN_PREFIX_LENGTH = 12;

// Verifying a token means a bcrypt compare at cost 12 (around 250 ms) on
// every Bearer request. A short-lived cache keyed by the token's SHA-256
// keeps API and MCP clients fast; revoke/delete clear it, and expiry is
// re-checked on every hit.
const VERIFY_CACHE_TTL_MS = 5 * 60 * 1000;
const VERIFY_CACHE_MAX = 5000;
const verifiedTokens = new Map();

// Keyed with a secret that exists only for this process's lifetime, so the
// cache keys are useless to anyone who does not also hold the process.
const cacheKeySecret = crypto.randomBytes(32);
// This is a lookup key for a short-lived in-memory cache, not password
// storage: the token itself is still verified with bcrypt on a miss.
// codeql[js/insufficient-password-hash]
const cacheKeyFor = (tokenValue) =>
    crypto
        .createHmac('sha256', cacheKeySecret)
        .update(tokenValue)
        .digest('hex');

function rememberVerified(tokenValue, tokenId) {
    if (verifiedTokens.size >= VERIFY_CACHE_MAX) {
        const oldest = verifiedTokens.keys().next().value;
        verifiedTokens.delete(oldest);
    }
    verifiedTokens.set(cacheKeyFor(tokenValue), {
        tokenId,
        expires: Date.now() + VERIFY_CACHE_TTL_MS,
    });
}

function forgetToken(tokenId) {
    for (const [key, entry] of verifiedTokens) {
        if (entry.tokenId === tokenId) verifiedTokens.delete(key);
    }
}

function clearVerifiedTokenCache() {
    verifiedTokens.clear();
}

const serializeApiToken = (tokenInstance) => {
    if (!tokenInstance) return null;
    const tokenJson = tokenInstance.toJSON();
    return {
        id: tokenJson.id,
        name: tokenJson.name,
        token_prefix: tokenJson.token_prefix,
        created_at: tokenJson.created_at,
        updated_at: tokenJson.updated_at,
        last_used_at: tokenJson.last_used_at,
        expires_at: tokenJson.expires_at,
        revoked_at: tokenJson.revoked_at,
    };
};

const generateRawToken = () => `tt_${crypto.randomBytes(32).toString('hex')}`;

async function createApiToken({ userId, name, expiresAt, abilities = null }) {
    const rawToken = generateRawToken();
    const tokenHash = await bcrypt.hash(rawToken, 12);
    const tokenPrefix = rawToken.slice(0, TOKEN_PREFIX_LENGTH);

    const tokenRecord = await ApiToken.create({
        user_id: userId,
        name: name || 'Personal Access Token',
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        abilities,
        expires_at: expiresAt || null,
    });

    return { rawToken, tokenRecord };
}

const isUsable = (token) =>
    token &&
    !token.revoked_at &&
    !(token.expires_at && token.expires_at < new Date());

async function findValidTokenByValue(tokenValue) {
    if (!tokenValue) return null;

    const cached = verifiedTokens.get(cacheKeyFor(tokenValue));
    if (cached && cached.expires > Date.now()) {
        const token = await ApiToken.findByPk(cached.tokenId);
        if (isUsable(token)) return token;
        verifiedTokens.delete(cacheKeyFor(tokenValue));
    }

    const prefix = tokenValue.slice(0, TOKEN_PREFIX_LENGTH);
    const possibleTokens = await ApiToken.findAll({
        where: { token_prefix: prefix },
        order: [['created_at', 'DESC']],
    });

    for (const token of possibleTokens) {
        if (!isUsable(token)) continue;
        const match = await bcrypt.compare(tokenValue, token.token_hash);
        if (match) {
            rememberVerified(tokenValue, token.id);
            return token;
        }
    }

    return null;
}

async function revokeApiToken(tokenId, userId) {
    const token = await ApiToken.findOne({
        where: { id: tokenId, user_id: userId },
    });

    if (!token) {
        return null;
    }

    forgetToken(token.id);
    if (!token.revoked_at) {
        token.revoked_at = new Date();
        await token.save();
    }

    return token;
}

async function deleteApiToken(tokenId, userId) {
    const token = await ApiToken.findOne({
        where: { id: tokenId, user_id: userId },
    });

    if (!token) {
        return null;
    }

    forgetToken(token.id);
    await token.destroy();
    return true;
}

module.exports = {
    createApiToken,
    revokeApiToken,
    deleteApiToken,
    findValidTokenByValue,
    serializeApiToken,
    clearVerifiedTokenCache,
    TOKEN_PREFIX_LENGTH,
};
