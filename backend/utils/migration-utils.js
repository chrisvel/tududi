'use strict';

async function safeAddColumns(queryInterface, tableName, columns) {
    try {
        const tableInfo = await queryInterface.describeTable(tableName);

        for (const column of columns) {
            if (!(column.name in tableInfo)) {
                await queryInterface.addColumn(
                    tableName,
                    column.name,
                    column.definition
                );
            }
        }
    } catch (error) {
        console.log(`Migration error for table ${tableName}:`, error.message);
        throw error;
    }
}

async function safeCreateTable(queryInterface, tableName, tableDefinition) {
    try {
        const tableExists = await queryInterface
            .showAllTables()
            .then((tables) => tables.includes(tableName));

        if (!tableExists) {
            await queryInterface.createTable(tableName, tableDefinition);
        }
    } catch (error) {
        console.log(
            `Migration error creating table ${tableName}:`,
            error.message
        );
        throw error;
    }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
    try {
        const indexes = await queryInterface.showIndex(tableName);
        const indexExists = indexes.some((index) =>
            index.fields.some((field) => fields.includes(field.attribute))
        );

        if (!indexExists) {
            await queryInterface.addIndex(tableName, fields, options);
        }
    } catch (error) {
        console.log(
            `Migration error adding index to ${tableName}:`,
            error.message
        );
    }
}

async function safeRemoveColumn(queryInterface, tableName, columnName) {
    try {
        const tableInfo = await queryInterface.describeTable(tableName);

        if (!(columnName in tableInfo)) {
            console.log(
                `Column ${columnName} does not exist in ${tableName}, skipping removal`
            );
            return;
        }

        const dialect = queryInterface.sequelize.getDialect();

        // SQLite doesn't support DROP COLUMN, so we need to recreate the table
        if (dialect === 'sqlite') {
            const transaction = await queryInterface.sequelize.transaction();

            try {
                // Get all columns except the one to remove
                const columns = Object.keys(tableInfo).filter(
                    (col) => col !== columnName
                );

                // Build column definitions for new table
                const columnDefs = columns
                    .map((col) => {
                        const info = tableInfo[col];
                        let def = `${col} ${info.type}`;

                        if (info.primaryKey) {
                            def += ' PRIMARY KEY';
                        }
                        if (info.autoIncrement) {
                            def += ' AUTOINCREMENT';
                        }
                        if (!info.allowNull) {
                            def += ' NOT NULL';
                        }
                        if (info.unique) {
                            def += ' UNIQUE';
                        }
                        if (
                            info.defaultValue !== undefined &&
                            info.defaultValue !== null
                        ) {
                            // Properly quote string defaults
                            const defaultVal =
                                typeof info.defaultValue === 'string'
                                    ? `'${info.defaultValue.replace(/'/g, "''")}'`
                                    : info.defaultValue;
                            def += ` DEFAULT ${defaultVal}`;
                        }

                        return def;
                    })
                    .join(', ');

                // Create new table without the column
                await queryInterface.sequelize.query(
                    `CREATE TABLE ${tableName}_new (${columnDefs});`,
                    { transaction }
                );

                // Copy data
                const columnList = columns.join(', ');
                await queryInterface.sequelize.query(
                    `INSERT INTO ${tableName}_new (${columnList}) SELECT ${columnList} FROM ${tableName};`,
                    { transaction }
                );

                // Drop old table
                await queryInterface.sequelize.query(
                    `DROP TABLE ${tableName};`,
                    { transaction }
                );

                // Rename new table
                await queryInterface.sequelize.query(
                    `ALTER TABLE ${tableName}_new RENAME TO ${tableName};`,
                    { transaction }
                );

                await transaction.commit();
                console.log(
                    `Successfully removed column ${columnName} from ${tableName}`
                );
            } catch (error) {
                await transaction.rollback();
                console.log(
                    `Migration error removing column ${columnName} from ${tableName}:`,
                    error.message
                );
                throw error;
            }
        } else {
            // For other databases, use standard removeColumn
            await queryInterface.removeColumn(tableName, columnName);
        }
    } catch (error) {
        console.log(
            `Migration error removing column ${columnName} from ${tableName}:`,
            error.message
        );
        throw error;
    }
}

module.exports = {
    safeAddColumns,
    safeCreateTable,
    safeAddIndex,
    safeRemoveColumn,
};
