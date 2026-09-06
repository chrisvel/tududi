const bcrypt = require('bcrypt');
const { ApiToken } = require('../../../models');
const {
    createApiToken,
    findValidTokenByValue,
    revokeApiToken,
    deleteApiToken,
    clearVerifiedTokenCache,
} = require('../../../modules/users/apiTokenService');
const { createTestUser } = require('../../helpers/testUtils');

describe('API token verification cache', () => {
    let user;

    beforeEach(async () => {
        clearVerifiedTokenCache();
        user = await createTestUser({
            email: `tok_${Date.now()}@example.com`,
        });
    });

    it('verifies with bcrypt once and answers from the cache afterwards', async () => {
        const { rawToken, tokenRecord } = await createApiToken({
            userId: user.id,
            name: 'cached',
        });
        const compare = jest.spyOn(bcrypt, 'compare');

        const first = await findValidTokenByValue(rawToken);
        expect(first.id).toBe(tokenRecord.id);
        expect(compare).toHaveBeenCalledTimes(1);

        const second = await findValidTokenByValue(rawToken);
        expect(second.id).toBe(tokenRecord.id);
        expect(compare).toHaveBeenCalledTimes(1);
        compare.mockRestore();
    });

    it('stops answering after revoke and after delete', async () => {
        const { rawToken, tokenRecord } = await createApiToken({
            userId: user.id,
            name: 'revoked',
        });
        expect(await findValidTokenByValue(rawToken)).not.toBeNull();

        await revokeApiToken(tokenRecord.id, user.id);
        expect(await findValidTokenByValue(rawToken)).toBeNull();

        const other = await createApiToken({ userId: user.id, name: 'gone' });
        expect(await findValidTokenByValue(other.rawToken)).not.toBeNull();
        await deleteApiToken(other.tokenRecord.id, user.id);
        expect(await findValidTokenByValue(other.rawToken)).toBeNull();
    });

    it('re-checks expiry on cache hits', async () => {
        const { rawToken, tokenRecord } = await createApiToken({
            userId: user.id,
            name: 'expiring',
            expiresAt: new Date(Date.now() + 60_000),
        });
        expect(await findValidTokenByValue(rawToken)).not.toBeNull();

        await ApiToken.update(
            { expires_at: new Date(Date.now() - 1000) },
            { where: { id: tokenRecord.id } }
        );
        expect(await findValidTokenByValue(rawToken)).toBeNull();
    });

    it('never caches a wrong token', async () => {
        await createApiToken({ userId: user.id, name: 'real' });
        expect(await findValidTokenByValue('tt_' + 'f'.repeat(64))).toBeNull();
        expect(await findValidTokenByValue('tt_' + 'f'.repeat(64))).toBeNull();
    });
});
