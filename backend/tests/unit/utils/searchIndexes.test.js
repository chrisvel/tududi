const { sequelize } = require('../../../models');
const {
    ensureSearchIndexes,
    dropSearchIndexes,
    SEARCH_INDEXES,
} = require('../../../utils/searchIndexes');

describe('search indexes', () => {
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
