const { sequelize, RateLimit } = require('../../../models');
const { isPostgres } = require('../../../utils/db-dialect');
const {
    DatabaseRateLimitStore,
    createRateLimitStore,
    cleanupExpiredRateLimits,
} = require('../../../middleware/rateLimitStore');

// The upsert uses ON CONFLICT ... RETURNING, so most of this is only
// exercised against a real PostgreSQL (DATABASE_URL in the environment).
const describePg = isPostgres() ? describe : describe.skip;
const describeSqlite = isPostgres() ? describe.skip : describe;

describeSqlite('createRateLimitStore on SQLite', () => {
    it('returns undefined so express-rate-limit uses its memory store', () => {
        expect(createRateLimitStore('unit')).toBeUndefined();
    });
});

describePg('createRateLimitStore on PostgreSQL', () => {
    it('returns the shared database store', () => {
        expect(createRateLimitStore('unit')).toBeInstanceOf(
            DatabaseRateLimitStore
        );
    });
});

describePg('DatabaseRateLimitStore (PostgreSQL)', () => {
    let store;

    beforeAll(async () => {
        await sequelize.sync();
    });

    beforeEach(async () => {
        await RateLimit.destroy({ where: {} });
        store = new DatabaseRateLimitStore('unit');
        store.init({ windowMs: 60 * 1000 });
    });

    it('counts hits within a window and namespaces by prefix', async () => {
        const first = await store.increment('1.2.3.4');
        const second = await store.increment('1.2.3.4');
        expect(first.totalHits).toBe(1);
        expect(second.totalHits).toBe(2);
        expect(second.resetTime.getTime()).toBe(first.resetTime.getTime());

        const other = new DatabaseRateLimitStore('other');
        other.init({ windowMs: 60 * 1000 });
        expect((await other.increment('1.2.3.4')).totalHits).toBe(1);
    });

    it('starts a new window once the old one has expired', async () => {
        await store.increment('k');
        await RateLimit.update(
            { reset_at: new Date(Date.now() - 1000) },
            { where: { key: 'unit:k' } }
        );

        const res = await store.increment('k');
        expect(res.totalHits).toBe(1);
        expect(res.resetTime.getTime()).toBeGreaterThan(Date.now());
        expect(await store.get('k')).toMatchObject({ totalHits: 1 });
    });

    it('decrements, resets one key, and resets all keys of the prefix', async () => {
        await store.increment('a');
        await store.increment('a');
        await store.decrement('a');
        expect((await store.get('a')).totalHits).toBe(1);

        await store.resetKey('a');
        expect(await store.get('a')).toBeUndefined();

        await store.increment('b');
        await store.increment('c');
        await store.resetAll();
        expect(await RateLimit.count()).toBe(0);
    });

    it('sweeps expired rows', async () => {
        await store.increment('old');
        await store.increment('fresh');
        await RateLimit.update(
            { reset_at: new Date(Date.now() - 1000) },
            { where: { key: 'unit:old' } }
        );

        const removed = await cleanupExpiredRateLimits();
        expect(removed).toBe(1);
        expect(await RateLimit.count()).toBe(1);
    });
});
