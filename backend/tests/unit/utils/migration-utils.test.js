const { safeAddColumns, safeCreateTable, safeAddIndex, safeRemoveColumn, safeChangeColumn } = require('../../../utils/migration-utils');

describe('migration-utils', () => {
    let queryInterface;

    beforeEach(() => {
        queryInterface = {
            showAllTables: jest.fn(),
            describeTable: jest.fn(),
            addColumn: jest.fn(),
            removeColumn: jest.fn(),
            createTable: jest.fn(),
            showIndex: jest.fn(),
            addIndex: jest.fn(),
            changeColumn: jest.fn(),
            sequelize: {
                getDialect: jest.fn().mockReturnValue('postgres'),
                query: jest.fn(),
            },
        };
    });

    describe('safeAddColumns', () => {
        it('should skip when table does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue(['other_table']);
            await safeAddColumns(queryInterface, 'missing_table', [
                { name: 'col1', definition: { type: 'TEXT' } },
            ]);
            expect(queryInterface.addColumn).not.toHaveBeenCalled();
        });

        it('should add column when it does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {}, title: {} });
            const definition = { type: 'TEXT' };

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'description', definition },
            ]);

            expect(queryInterface.addColumn).toHaveBeenCalledWith('tasks', 'description', definition);
        });

        it('should skip column when it already exists', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {}, title: {} });

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'title', definition: { type: 'TEXT' } },
            ]);

            expect(queryInterface.addColumn).not.toHaveBeenCalled();
        });

        it('should add multiple columns, skipping existing ones', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {}, title: {} });

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'title', definition: { type: 'TEXT' } },       // exists
                { name: 'priority', definition: { type: 'INTEGER' } }, // new
                { name: 'due_date', definition: { type: 'DATE' } },    // new
            ]);

            expect(queryInterface.addColumn).toHaveBeenCalledTimes(2);
            expect(queryInterface.addColumn).toHaveBeenCalledWith('tasks', 'priority', { type: 'INTEGER' });
            expect(queryInterface.addColumn).toHaveBeenCalledWith('tasks', 'due_date', { type: 'DATE' });
        });

        it('should re-throw errors from addColumn', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {} });
            queryInterface.addColumn.mockRejectedValue(new Error('DB error'));

            await expect(
                safeAddColumns(queryInterface, 'tasks', [{ name: 'col', definition: { type: 'TEXT' } }])
            ).rejects.toThrow('DB error');
        });
    });

    describe('safeCreateTable', () => {
        it('should create table when it does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);
            const definition = { id: { type: 'INTEGER', primaryKey: true } };

            await safeCreateTable(queryInterface, 'new_table', definition);

            expect(queryInterface.createTable).toHaveBeenCalledWith('new_table', definition);
        });

        it('should skip when table already exists', async () => {
            queryInterface.showAllTables.mockResolvedValue(['existing_table']);

            await safeCreateTable(queryInterface, 'existing_table', {});

            expect(queryInterface.createTable).not.toHaveBeenCalled();
        });

        it('should re-throw errors from createTable', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);
            queryInterface.createTable.mockRejectedValue(new Error('Create failed'));

            await expect(
                safeCreateTable(queryInterface, 'fail_table', {})
            ).rejects.toThrow('Create failed');
        });
    });

    describe('safeAddIndex', () => {
        it('should skip when table does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);
            await safeAddIndex(queryInterface, 'missing_table', ['col1']);
            expect(queryInterface.addIndex).not.toHaveBeenCalled();
        });

        it('should add index when it does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.showIndex.mockResolvedValue([]);

            await safeAddIndex(queryInterface, 'tasks', ['user_id'], { name: 'idx_user' });

            expect(queryInterface.addIndex).toHaveBeenCalledWith('tasks', ['user_id'], { name: 'idx_user' });
        });

        it('should skip when a matching index already exists', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.showIndex.mockResolvedValue([
                { fields: [{ attribute: 'user_id' }] },
            ]);

            await safeAddIndex(queryInterface, 'tasks', ['user_id']);

            expect(queryInterface.addIndex).not.toHaveBeenCalled();
        });

        it('should not throw on addIndex failure (swallows error)', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.showIndex.mockResolvedValue([]);
            queryInterface.addIndex.mockRejectedValue(new Error('Index error'));

            // safeAddIndex swallows errors (no throw in the catch)
            await expect(
                safeAddIndex(queryInterface, 'tasks', ['col'])
            ).resolves.toBeUndefined();
        });
    });

    describe('safeRemoveColumn', () => {
        it('should skip when column does not exist', async () => {
            queryInterface.describeTable.mockResolvedValue({ id: {}, title: {} });

            await safeRemoveColumn(queryInterface, 'tasks', 'nonexistent');

            expect(queryInterface.removeColumn).not.toHaveBeenCalled();
        });

        it('should remove column on non-SQLite dialect', async () => {
            queryInterface.describeTable.mockResolvedValue({ id: {}, title: {}, old_col: {} });
            queryInterface.sequelize.getDialect.mockReturnValue('postgres');

            await safeRemoveColumn(queryInterface, 'tasks', 'old_col');

            expect(queryInterface.removeColumn).toHaveBeenCalledWith('tasks', 'old_col');
        });

        it('should use table recreation strategy on SQLite', async () => {
            queryInterface.describeTable.mockResolvedValue({
                id: { type: 'INTEGER', primaryKey: true, autoIncrement: true, allowNull: false },
                title: { type: 'TEXT', allowNull: true },
                remove_me: { type: 'TEXT', allowNull: true },
            });
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeRemoveColumn(queryInterface, 'tasks', 'remove_me');

            // Should have called multiple queries for SQLite recreation
            const calls = queryInterface.sequelize.query.mock.calls.map((c) => c[0]);
            expect(calls.some((q) => q.includes('PRAGMA foreign_keys = OFF'))).toBe(true);
            expect(calls.some((q) => q.includes('CREATE TABLE tasks_new'))).toBe(true);
            expect(calls.some((q) => q.includes('INSERT INTO tasks_new'))).toBe(true);
            expect(calls.some((q) => q.includes('DROP TABLE tasks'))).toBe(true);
            expect(calls.some((q) => q.includes('ALTER TABLE tasks_new RENAME TO tasks'))).toBe(true);
            expect(calls.some((q) => q.includes('PRAGMA foreign_keys = ON'))).toBe(true);
            // remove_me should not appear in CREATE TABLE
            const createCall = calls.find((q) => q.includes('CREATE TABLE tasks_new'));
            expect(createCall).not.toContain('remove_me');
        });

        it('should re-throw errors', async () => {
            queryInterface.describeTable.mockRejectedValue(new Error('Describe failed'));

            await expect(
                safeRemoveColumn(queryInterface, 'tasks', 'col')
            ).rejects.toThrow('Describe failed');
        });
    });

    describe('safeChangeColumn', () => {
        it('should skip when table does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);

            await safeChangeColumn(queryInterface, 'missing', 'col', { type: 'TEXT' });

            expect(queryInterface.changeColumn).not.toHaveBeenCalled();
        });

        it('should skip when column does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {} });

            await safeChangeColumn(queryInterface, 'tasks', 'nonexistent', { type: 'TEXT' });

            expect(queryInterface.changeColumn).not.toHaveBeenCalled();
        });

        it('should change column on non-SQLite dialect', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: { type: 'TEXT', allowNull: true },
            });
            queryInterface.sequelize.getDialect.mockReturnValue('postgres');
            const newDef = { type: 'VARCHAR(255)', allowNull: false };

            await safeChangeColumn(queryInterface, 'tasks', 'title', newDef);

            expect(queryInterface.changeColumn).toHaveBeenCalledWith('tasks', 'title', newDef);
        });

        it('should use table recreation on SQLite', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: { type: 'INTEGER', primaryKey: true, autoIncrement: true, allowNull: false },
                title: { type: 'TEXT', allowNull: true },
            });
            queryInterface.showIndex.mockResolvedValue([]);
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeChangeColumn(queryInterface, 'tasks', 'title', {
                type: { toSql: () => 'VARCHAR(255)' },
                allowNull: false,
            });

            const calls = queryInterface.sequelize.query.mock.calls.map((c) => c[0]);
            expect(calls.some((q) => q.includes('CREATE TABLE tasks_new'))).toBe(true);
            const createCall = calls.find((q) => q.includes('CREATE TABLE tasks_new'));
            expect(createCall).toContain('VARCHAR(255)');
            expect(createCall).toContain('NOT NULL');
        });

        it('should re-throw errors', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {}, col: {} });
            queryInterface.sequelize.getDialect.mockReturnValue('postgres');
            queryInterface.changeColumn.mockRejectedValue(new Error('Change failed'));

            await expect(
                safeChangeColumn(queryInterface, 'tasks', 'col', { type: 'TEXT' })
            ).rejects.toThrow('Change failed');
        });
    });
});