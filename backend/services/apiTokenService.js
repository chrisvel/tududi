const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { ApiToken } = require('../models');

const TOKEN_PREFIX_LENGTH = 12;

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

async function findValidTokenByValue(tokenValue) {
    if (!tokenValue) return null;
    const prefix = tokenValue.slice(0, TOKEN_PREFIX_LENGTH);
    const possibleTokens = await ApiToken.findAll({
        where: { token_prefix: prefix },
        order: [['created_at', 'DESC']],
    });

    for (const token of possibleTokens) {
        if (token.revoked_at) continue;
        if (token.expires_at && token.expires_at < new Date()) continue;
        const match = await bcrypt.compare(tokenValue, token.token_hash);
        if (match) {
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

    await token.destroy();
    return true;
}

module.exports = {
    createApiToken,
    revokeApiToken,
    deleteApiToken,
    findValidTokenByValue,
    serializeApiToken,
    TOKEN_PREFIX_LENGTH,
};
