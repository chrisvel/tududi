const { DataTypes } = require('sequelize');
const {
    safeAddColumns,
    safeCreateTable,
    safeAddIndex,
    safeRemoveColumn,
    safeChangeColumn,
} = require('../../../utils/migration-utils');

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
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: {},
            });
            const definition = { type: 'TEXT' };

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'description', definition },
            ]);

            expect(queryInterface.addColumn).toHaveBeenCalledWith(
                'tasks',
                'description',
                definition
            );
        });

        it('should skip column when it already exists', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: {},
            });

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'title', definition: { type: 'TEXT' } },
            ]);

            expect(queryInterface.addColumn).not.toHaveBeenCalled();
        });

        it('should add multiple columns, skipping existing ones', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: {},
            });

            await safeAddColumns(queryInterface, 'tasks', [
                { name: 'title', definition: { type: 'TEXT' } }, // exists
                { name: 'priority', definition: { type: 'INTEGER' } }, // new
                { name: 'due_date', definition: { type: 'DATE' } }, // new
            ]);

            expect(queryInterface.addColumn).toHaveBeenCalledTimes(2);
            expect(queryInterface.addColumn).toHaveBeenCalledWith(
                'tasks',
                'priority',
                { type: 'INTEGER' }
            );
            expect(queryInterface.addColumn).toHaveBeenCalledWith(
                'tasks',
                'due_date',
                { type: 'DATE' }
            );
        });

        it('should re-throw errors from addColumn', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {} });
            queryInterface.addColumn.mockRejectedValue(new Error('DB error'));

            await expect(
                safeAddColumns(queryInterface, 'tasks', [
                    { name: 'col', definition: { type: 'TEXT' } },
                ])
            ).rejects.toThrow('DB error');
        });
    });

    describe('safeCreateTable', () => {
        it('should create table when it does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);
            const definition = { id: { type: 'INTEGER', primaryKey: true } };

            await safeCreateTable(queryInterface, 'new_table', definition);

            expect(queryInterface.createTable).toHaveBeenCalledWith(
                'new_table',
                definition
            );
        });

        it('should skip when table already exists', async () => {
            queryInterface.showAllTables.mockResolvedValue(['existing_table']);

            await safeCreateTable(queryInterface, 'existing_table', {});

            expect(queryInterface.createTable).not.toHaveBeenCalled();
        });

        it('should re-throw errors from createTable', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);
            queryInterface.createTable.mockRejectedValue(
                new Error('Create failed')
            );

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

            await safeAddIndex(queryInterface, 'tasks', ['user_id'], {
                name: 'idx_user',
            });

            expect(queryInterface.addIndex).toHaveBeenCalledWith(
                'tasks',
                ['user_id'],
                { name: 'idx_user' }
            );
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
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: {},
            });

            await safeRemoveColumn(queryInterface, 'tasks', 'nonexistent');

            expect(queryInterface.removeColumn).not.toHaveBeenCalled();
        });

        it('should remove column on non-SQLite dialect', async () => {
            queryInterface.describeTable.mockResolvedValue({
                id: {},
                title: {},
                old_col: {},
            });
            queryInterface.sequelize.getDialect.mockReturnValue('postgres');

            await safeRemoveColumn(queryInterface, 'tasks', 'old_col');

            expect(queryInterface.removeColumn).toHaveBeenCalledWith(
                'tasks',
                'old_col'
            );
        });

        it('should use table recreation strategy on SQLite', async () => {
            queryInterface.describeTable.mockResolvedValue({
                id: {
                    type: 'INTEGER',
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                title: { type: 'TEXT', allowNull: true },
                remove_me: { type: 'TEXT', allowNull: true },
            });
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeRemoveColumn(queryInterface, 'tasks', 'remove_me');

            // Should have called multiple queries for SQLite recreation
            const calls = queryInterface.sequelize.query.mock.calls.map(
                (c) => c[0]
            );
            expect(
                calls.some((q) => q.includes('PRAGMA foreign_keys = OFF'))
            ).toBe(true);
            expect(
                calls.some((q) => q.includes('CREATE TABLE tasks_new'))
            ).toBe(true);
            expect(calls.some((q) => q.includes('INSERT INTO tasks_new'))).toBe(
                true
            );
            expect(calls.some((q) => q.includes('DROP TABLE tasks'))).toBe(
                true
            );
            expect(
                calls.some((q) =>
                    q.includes('ALTER TABLE tasks_new RENAME TO tasks')
                )
            ).toBe(true);
            expect(
                calls.some((q) => q.includes('PRAGMA foreign_keys = ON'))
            ).toBe(true);
            // remove_me should not appear in CREATE TABLE
            const createCall = calls.find((q) =>
                q.includes('CREATE TABLE tasks_new')
            );
            expect(createCall).not.toContain('remove_me');
        });

        it('should re-throw errors', async () => {
            queryInterface.describeTable.mockRejectedValue(
                new Error('Describe failed')
            );

            await expect(
                safeRemoveColumn(queryInterface, 'tasks', 'col')
            ).rejects.toThrow('Describe failed');
        });
    });

    describe('safeChangeColumn', () => {
        it('should skip when table does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue([]);

            await safeChangeColumn(queryInterface, 'missing', 'col', {
                type: 'TEXT',
            });

            expect(queryInterface.changeColumn).not.toHaveBeenCalled();
        });

        it('should skip when column does not exist', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {} });

            await safeChangeColumn(queryInterface, 'tasks', 'nonexistent', {
                type: 'TEXT',
            });

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

            expect(queryInterface.changeColumn).toHaveBeenCalledWith(
                'tasks',
                'title',
                newDef
            );
        });

        it('should use table recreation on SQLite', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {
                    type: 'INTEGER',
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                title: { type: 'TEXT', allowNull: true },
            });
            queryInterface.showIndex.mockResolvedValue([]);
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeChangeColumn(queryInterface, 'tasks', 'title', {
                type: { toSql: () => 'VARCHAR(255)' },
                allowNull: false,
            });

            const calls = queryInterface.sequelize.query.mock.calls.map(
                (c) => c[0]
            );
            expect(
                calls.some((q) => q.includes('CREATE TABLE tasks_new'))
            ).toBe(true);
            const createCall = calls.find((q) =>
                q.includes('CREATE TABLE tasks_new')
            );
            expect(createCall).toContain('VARCHAR(255)');
            expect(createCall).toContain('NOT NULL');
        });

        it('should render a data type class as SQL rather than its bare name', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {
                    type: 'INTEGER',
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                uid: { type: 'STRING', allowNull: false },
            });
            queryInterface.showIndex.mockResolvedValue([]);
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeChangeColumn(queryInterface, 'tasks', 'uid', {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            });

            const createCall = queryInterface.sequelize.query.mock.calls
                .map((call) => call[0])
                .find((query) => query.includes('CREATE TABLE tasks_new'));
            // A column declared "STRING" gets NUMERIC affinity in SQLite, which
            // stores a numeric uid as an integer and mangles it past 2^53.
            expect(createCall).toContain('VARCHAR(255)');
            expect(createCall).not.toContain('`uid` STRING');
        });

        it('should re-throw errors', async () => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({ id: {}, col: {} });
            queryInterface.sequelize.getDialect.mockReturnValue('postgres');
            queryInterface.changeColumn.mockRejectedValue(
                new Error('Change failed')
            );

            await expect(
                safeChangeColumn(queryInterface, 'tasks', 'col', {
                    type: 'TEXT',
                })
            ).rejects.toThrow('Change failed');
        });
    });

    // The definitions below are the ones the migrations on disk actually pass to
    // safeChangeColumn. Rendering a data type class by its bare name (`STRING`,
    // `BOOLEAN`) is what gives a SQLite column NUMERIC affinity and stores a
    // numeric uid as an integer, so the fix instantiates the class and renders
    // SQL instead. That changes the DDL these migrations emit, so pin it here:
    // anything that renders differently than this table is a behaviour change to
    // migrations that have already shipped, not a local detail.
    describe('safeChangeColumn: the DDL the existing migrations emit', () => {
        const ddlFor = async (definition) => {
            queryInterface.showAllTables.mockResolvedValue(['tasks']);
            queryInterface.describeTable.mockResolvedValue({
                id: {
                    type: 'INTEGER',
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false,
                },
                uid: { type: 'STRING', allowNull: false },
            });
            queryInterface.showIndex.mockResolvedValue([]);
            queryInterface.sequelize.getDialect.mockReturnValue('sqlite');

            await safeChangeColumn(queryInterface, 'tasks', 'uid', definition);

            return queryInterface.sequelize.query.mock.calls
                .map((call) => call[0])
                .find((query) => query.includes('CREATE TABLE tasks_new'));
        };

        // A data type is described by its `key` when it is passed as the class
        // itself (`DataTypes.STRING`), and by an instance carrying its length
        // when it is called (`DataTypes.STRING(100)`). The key is what the fix
        // stopped rendering.
        const keyOf = (definition) =>
            typeof definition === 'string'
                ? definition
                : definition.key || String(definition);

        // label, definition, the SQL type it must render as.
        const cases = [
            [
                'TEXT(long) - oidc picture, inbox content',
                DataTypes.TEXT('long'),
                'LONGTEXT',
            ],
            ['INTEGER - goals area_id', DataTypes.INTEGER, 'INTEGER'],
            ['JSON - notification preferences', DataTypes.JSON, 'JSON'],
            ['TEXT', DataTypes.TEXT, 'TEXT'],
            [
                'STRING(100) - a call, not the class',
                DataTypes.STRING(100),
                'VARCHAR(100)',
            ],
            ['a literal string', 'VARCHAR(255)', 'VARCHAR(255)'],
            ['STRING - uid columns', DataTypes.STRING, 'VARCHAR(255)'],
            ['BOOLEAN - not used yet', DataTypes.BOOLEAN, 'TINYINT(1)'],
            ['DATE - not used yet', DataTypes.DATE, 'DATETIME'],
        ];

        // A bare `toContain` is not enough for the negative check: "`uid` DATE"
        // is a substring of the correct "`uid` DATETIME", so the match has to end
        // at a word boundary.
        const escapeForRegex = (value) =>
            value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        it.each(cases)(
            'renders %s as %s',
            async (label, definition, expected) => {
                const ddl = await ddlFor({
                    type: definition,
                    allowNull: false,
                });

                // A trailing \b would not match after ")" - both it and the
                // space that follows are non-word characters - so the type has to
                // end at whitespace, a semicolon, or the end of the statement.
                expect(ddl).toMatch(
                    new RegExp(
                        `\`uid\` ${escapeForRegex(expected)}(?=[\\s;]|$)`
                    )
                );

                // Before the fix the key was rendered instead: `uid` STRING,
                // `uid` DATE. Where the key is not the SQL the column needs it
                // must be gone from the statement; where the two are the same
                // string it is what the column is supposed to say. The match for
                // the key ends at whitespace or the end of the statement, so that
                // "`uid` DATE" is not read as a substring of the correct
                // "`uid` DATETIME", nor "`uid` STRING" of a "STRING(100)" that
                // happens to be part of a longer word.
                const key = keyOf(definition);
                expect({
                    key,
                    declared: new RegExp(
                        `\`uid\` ${escapeForRegex(key)}(?=[\\s;]|$)`
                    ).test(ddl),
                }).toEqual({ key, declared: key === expected });
            }
        );

        it('leaves every other column of the rebuilt table alone', async () => {
            const ddl = await ddlFor({
                type: DataTypes.STRING,
                allowNull: false,
            });

            // The rebuild copies the whole table, so a type regression on any
            // other column would be silent data loss rather than a failed change.
            expect(ddl).toContain(
                '`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL'
            );
        });
    });
});
