const { sequelize } = require('../../../models');
const { isPostgres } = require('../../../utils/db-dialect');
const {
    ensureSearchIndexes,
    dropSearchIndexes,
    SEARCH_INDEXES,
} = require('../../../utils/searchIndexes');

const describePg = isPostgres() ? describe : describe.skip;
const describeSqlite = isPostgres() ? describe.skip : describe;

describeSqlite('search indexes on SQLite', () => {
    it('is a no-op', async () => {
        expect(await ensureSearchIndexes(sequelize)).toEqual([]);
        await expect(dropSearchIndexes(sequelize)).resolves.toBeUndefined();
    });
});

describePg('search indexes on PostgreSQL', () => {
    beforeAll(async () => {
        await sequelize.sync();
    });

    afterAll(async () => {
        await dropSearchIndexes(sequelize);
    });

    const indexNames = async () => {
        const [rows] = await sequelize.query(
            "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_trgm' OR indexname = 'sessions_expires'"
        );
        return rows.map((r) => r.indexname).sort();
    };

    it('creates a trigram index per search column and is idempotent', async () => {
        const created = await ensureSearchIndexes(sequelize);
        for (const [, , name] of SEARCH_INDEXES) {
            expect(created).toContain(name);
        }
        const names = await indexNames();
        expect(names).toEqual(expect.arrayContaining(created));

        const again = await ensureSearchIndexes(sequelize);
        expect(again).toEqual(created);
        expect(await indexNames()).toEqual(names);
    });

    it('drops them again', async () => {
        await ensureSearchIndexes(sequelize);
        await dropSearchIndexes(sequelize);
        const names = await indexNames();
        for (const [, , name] of SEARCH_INDEXES) {
            expect(names).not.toContain(name);
        }
    });
});
