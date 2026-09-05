const { Op } = require('sequelize');

// The global test setup already loads utils/db-dialect against the real
// config, so each case loads a fresh copy bound to a mocked dialect.
function loadWithDialect(dialect) {
    let helpers;
    jest.isolateModules(() => {
        jest.doMock('../../../config/db', () => ({
            getDialect: () => dialect,
        }));
        helpers = require('../../../utils/db-dialect');
    });
    return helpers;
}

describe('db-dialect', () => {
    describe('on sqlite', () => {
        const helpers = loadWithDialect('sqlite');

        it('reports the dialect', () => {
            expect(helpers.isSqlite()).toBe(true);
            expect(helpers.isPostgres()).toBe(false);
        });

        it('ciLike uses LIKE', () => {
            expect(helpers.ciLike('%x%')).toEqual({ [Op.like]: '%x%' });
        });

        it('withForeignKeyChecksDisabled toggles the pragma around fn', async () => {
            const sequelize = { query: jest.fn().mockResolvedValue([]) };
            const fn = jest.fn().mockResolvedValue('result');

            const result = await helpers.withForeignKeyChecksDisabled(
                sequelize,
                fn
            );

            expect(result).toBe('result');
            expect(sequelize.query.mock.calls.map((c) => c[0])).toEqual([
                'PRAGMA foreign_keys = OFF',
                'PRAGMA foreign_keys = ON',
            ]);
        });

        it('withForeignKeyChecksDisabled re-enables checks when fn throws', async () => {
            const sequelize = { query: jest.fn().mockResolvedValue([]) };
            const fn = jest.fn().mockRejectedValue(new Error('boom'));

            await expect(
                helpers.withForeignKeyChecksDisabled(sequelize, fn, {
                    transaction: 'tx',
                })
            ).rejects.toThrow('boom');
            expect(sequelize.query).toHaveBeenLastCalledWith(
                'PRAGMA foreign_keys = ON',
                { transaction: 'tx' }
            );
        });

        it('truncateTables deletes each table with checks off', async () => {
            const sequelize = { query: jest.fn().mockResolvedValue([]) };

            await helpers.truncateTables(sequelize, ['a', 'b']);

            expect(sequelize.query.mock.calls.map((c) => c[0])).toEqual([
                'PRAGMA foreign_keys = OFF',
                'DELETE FROM a',
                'DELETE FROM b',
                'PRAGMA foreign_keys = ON',
            ]);
        });
    });

    describe('on postgres', () => {
        const helpers = loadWithDialect('postgres');

        it('reports the dialect', () => {
            expect(helpers.isSqlite()).toBe(false);
            expect(helpers.isPostgres()).toBe(true);
        });

        it('ciLike uses ILIKE', () => {
            expect(helpers.ciLike('%x%')).toEqual({ [Op.iLike]: '%x%' });
        });

        it('withForeignKeyChecksDisabled just runs fn', async () => {
            const sequelize = { query: jest.fn() };
            const fn = jest.fn().mockResolvedValue(42);

            expect(
                await helpers.withForeignKeyChecksDisabled(sequelize, fn)
            ).toBe(42);
            expect(sequelize.query).not.toHaveBeenCalled();
        });

        it('truncateTables deletes each table in the given order without pragmas', async () => {
            const sequelize = { query: jest.fn().mockResolvedValue([]) };

            await helpers.truncateTables(sequelize, ['a', 'b']);

            expect(sequelize.query.mock.calls.map((c) => c[0])).toEqual([
                'DELETE FROM "a"',
                'DELETE FROM "b"',
            ]);
        });

        it('truncateTables is a no-op for an empty list', async () => {
            const sequelize = { query: jest.fn() };
            await helpers.truncateTables(sequelize, []);
            expect(sequelize.query).not.toHaveBeenCalled();
        });
    });
});
