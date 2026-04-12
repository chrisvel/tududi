const crypto = require('crypto');
const { OIDCStateNonce } = require('../../models');

async function createState(providerSlug, redirectUri = null) {
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');

    await OIDCStateNonce.create({
        state,
        nonce,
        provider_slug: providerSlug,
        redirect_uri: redirectUri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
    });

    return { state, nonce };
}

async function validateState(state) {
    const record = await OIDCStateNonce.findOne({ where: { state } });

    if (!record) {
        throw new Error('Invalid state parameter');
    }

    if (new Date() > record.expires_at) {
        await OIDCStateNonce.destroy({ where: { state } });
        throw new Error('State expired');
    }

    return {
        nonce: record.nonce,
        providerSlug: record.provider_slug,
        redirectUri: record.redirect_uri,
    };
}

async function consumeState(state) {
    const deletedCount = await OIDCStateNonce.destroy({ where: { state } });
    return deletedCount > 0;
}

async function cleanupExpiredStates() {
    const deletedCount = await OIDCStateNonce.destroy({
        where: {
            expires_at: {
                [require('sequelize').Op.lt]: new Date(),
            },
        },
    });

    return deletedCount;
}

module.exports = {
    createState,
    validateState,
    consumeState,
    cleanupExpiredStates,
};
