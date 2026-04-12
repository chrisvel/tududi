const stateManager = require('../../../../modules/oidc/stateManager');
const { OIDCStateNonce } = require('../../../../models');
const { sequelize } = require('../../../../models');

describe('OIDC State Manager', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        await OIDCStateNonce.destroy({ where: {}, truncate: true });
    });

    describe('createState', () => {
        it('should create state with random values', async () => {
            const { state, nonce } = await stateManager.createState('google');

            expect(state).toBeDefined();
            expect(nonce).toBeDefined();
            expect(state).toHaveLength(64);
            expect(nonce).toHaveLength(64);
        });

        it('should store state in database', async () => {
            const { state, nonce } = await stateManager.createState('google');

            const record = await OIDCStateNonce.findOne({ where: { state } });

            expect(record).toBeDefined();
            expect(record.nonce).toBe(nonce);
            expect(record.provider_slug).toBe('google');
        });

        it('should set expiration to 10 minutes from now', async () => {
            const before = new Date();
            const { state } = await stateManager.createState('google');
            const after = new Date();

            const record = await OIDCStateNonce.findOne({ where: { state } });

            const expectedExpiry = new Date(before.getTime() + 10 * 60 * 1000);
            const expiryTime = new Date(record.expires_at).getTime();
            const expectedTime = expectedExpiry.getTime();

            expect(expiryTime).toBeGreaterThanOrEqual(expectedTime - 1000);
            expect(expiryTime).toBeLessThanOrEqual(
                new Date(after.getTime() + 10 * 60 * 1000).getTime() + 1000
            );
        });

        it('should generate unique state values', async () => {
            const { state: state1 } = await stateManager.createState('google');
            const { state: state2 } = await stateManager.createState('google');

            expect(state1).not.toBe(state2);
        });

        it('should store redirect URI if provided', async () => {
            const redirectUri = 'https://app.example.com/callback';
            const { state } = await stateManager.createState(
                'google',
                redirectUri
            );

            const record = await OIDCStateNonce.findOne({ where: { state } });

            expect(record.redirect_uri).toBe(redirectUri);
        });
    });

    describe('validateState', () => {
        it('should return nonce and provider for valid state', async () => {
            const { state, nonce } = await stateManager.createState('google');

            const result = await stateManager.validateState(state);

            expect(result.nonce).toBe(nonce);
            expect(result.providerSlug).toBe('google');
        });

        it('should throw error for non-existent state', async () => {
            await expect(
                stateManager.validateState('nonexistent')
            ).rejects.toThrow('Invalid state parameter');
        });

        it('should throw error for expired state', async () => {
            const { state } = await stateManager.createState('google');

            await OIDCStateNonce.update(
                { expires_at: new Date(Date.now() - 1000) },
                { where: { state } }
            );

            await expect(stateManager.validateState(state)).rejects.toThrow(
                'State expired'
            );
        });

        it('should delete expired state after validation attempt', async () => {
            const { state } = await stateManager.createState('google');

            await OIDCStateNonce.update(
                { expires_at: new Date(Date.now() - 1000) },
                { where: { state } }
            );

            try {
                await stateManager.validateState(state);
            } catch (error) {}

            const record = await OIDCStateNonce.findOne({ where: { state } });
            expect(record).toBeNull();
        });

        it('should return redirect URI if stored', async () => {
            const redirectUri = 'https://app.example.com/callback';
            const { state } = await stateManager.createState(
                'google',
                redirectUri
            );

            const result = await stateManager.validateState(state);

            expect(result.redirectUri).toBe(redirectUri);
        });
    });

    describe('consumeState', () => {
        it('should delete state from database', async () => {
            const { state } = await stateManager.createState('google');

            const consumed = await stateManager.consumeState(state);

            expect(consumed).toBe(true);

            const record = await OIDCStateNonce.findOne({ where: { state } });
            expect(record).toBeNull();
        });

        it('should return false for non-existent state', async () => {
            const consumed = await stateManager.consumeState('nonexistent');
            expect(consumed).toBe(false);
        });

        it('should be idempotent', async () => {
            const { state } = await stateManager.createState('google');

            await stateManager.consumeState(state);
            const secondConsume = await stateManager.consumeState(state);

            expect(secondConsume).toBe(false);
        });
    });

    describe('cleanupExpiredStates', () => {
        it('should delete expired states', async () => {
            await stateManager.createState('google');

            const { state: expiredState } =
                await stateManager.createState('okta');
            await OIDCStateNonce.update(
                { expires_at: new Date(Date.now() - 1000) },
                { where: { state: expiredState } }
            );

            const deletedCount = await stateManager.cleanupExpiredStates();

            expect(deletedCount).toBe(1);

            const remaining = await OIDCStateNonce.count();
            expect(remaining).toBe(1);
        });

        it('should not delete valid states', async () => {
            await stateManager.createState('google');
            await stateManager.createState('okta');

            const deletedCount = await stateManager.cleanupExpiredStates();

            expect(deletedCount).toBe(0);

            const remaining = await OIDCStateNonce.count();
            expect(remaining).toBe(2);
        });

        it('should return 0 when no expired states exist', async () => {
            const deletedCount = await stateManager.cleanupExpiredStates();
            expect(deletedCount).toBe(0);
        });
    });

    describe('state security', () => {
        it('should prevent state reuse after validation', async () => {
            const { state } = await stateManager.createState('google');

            await stateManager.validateState(state);
            await stateManager.consumeState(state);

            await expect(stateManager.validateState(state)).rejects.toThrow(
                'Invalid state parameter'
            );
        });

        it('should handle concurrent state creation', async () => {
            const promises = Array.from({ length: 10 }, () =>
                stateManager.createState('google')
            );

            const results = await Promise.all(promises);

            const states = results.map((r) => r.state);
            const uniqueStates = new Set(states);

            expect(uniqueStates.size).toBe(10);
        });
    });
});
