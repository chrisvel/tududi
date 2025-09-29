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

        if (columnName in tableInfo) {
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
