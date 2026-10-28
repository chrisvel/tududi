const { Op } = require('sequelize');
const { ciLike, truncateTables } = require('../../../utils/db-dialect');

describe('db-dialect', () => {
    it('ciLike uses ILIKE', () => {
        expect(ciLike('%x%')).toEqual({ [Op.iLike]: '%x%' });
    });

    it('truncateTables deletes each table in the given order', async () => {
        const sequelize = { query: jest.fn().mockResolvedValue([]) };

        await truncateTables(sequelize, ['tasks_tags', 'tasks']);

        expect(sequelize.query.mock.calls.map((c) => c[0])).toEqual([
            'DELETE FROM "tasks_tags"',
            'DELETE FROM "tasks"',
        ]);
    });
});
