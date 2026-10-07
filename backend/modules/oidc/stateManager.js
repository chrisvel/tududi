const crypto = require('crypto');
const { OIDCStateNonce } = require('../../models');

const STATE_TTL_MS = 10 * 60 * 1000;

function hashBindingToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// A state is issued to one browser: the random binding token is returned to
// the caller (which sets it as an httpOnly cookie) and only its hash is
// stored. codeVerifier is the PKCE secret for this flow, and userId is set
// when a signed-in user starts linking an identity to their account.
async function createState(
    providerSlug,
    redirectUri = null,
    { userId = null, codeVerifier = null } = {}
) {
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const bindingToken = crypto.randomBytes(32).toString('hex');

    await OIDCStateNonce.create({
        state,
        nonce,
        provider_slug: providerSlug,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        binding_hash: hashBindingToken(bindingToken),
        user_id: userId,
        expires_at: new Date(Date.now() + STATE_TTL_MS),
    });

    return { state, nonce, bindingToken };
}

async function validateState(state) {
    if (typeof state !== 'string' || !state) {
        throw new Error('Invalid state parameter');
    }

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
        codeVerifier: record.code_verifier,
        bindingHash: record.binding_hash,
        userId: record.user_id,
    };
}

// True only when the browser presented the token this state was issued to.
// A state created before binding existed has no hash and never matches.
function bindingMatches(expectedHash, bindingToken) {
    if (!expectedHash || !bindingToken) return false;

    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(hashBindingToken(bindingToken), 'hex');
    return (
        expected.length === actual.length &&
        crypto.timingSafeEqual(expected, actual)
    );
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
    bindingMatches,
    consumeState,
    cleanupExpiredStates,
};
