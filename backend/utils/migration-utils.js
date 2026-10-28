'use strict';

async function safeAddColumns(queryInterface, tableName, columns) {
    try {
        const tables = await queryInterface.showAllTables();
        const tableExists = tables.includes(tableName);

        if (!tableExists) {
            console.log(
                `Table ${tableName} does not exist, skipping column additions`
            );
            return;
        }

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
        const tables = await queryInterface.showAllTables();
        const tableExists = tables.includes(tableName);

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
        const tables = await queryInterface.showAllTables();
        const tableExists = tables.includes(tableName);

        if (!tableExists) {
            console.log(
                `Table ${tableName} does not exist, skipping index addition`
            );
            return;
        }

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

        await queryInterface.removeColumn(tableName, columnName);
    } catch (error) {
        console.log(
            `Migration error removing column ${columnName} from ${tableName}:`,
            error.message
        );
        throw error;
    }
}

async function safeChangeColumn(
    queryInterface,
    tableName,
    columnName,
    columnDefinition
) {
    try {
        const tables = await queryInterface.showAllTables();
        const tableExists = tables.includes(tableName);

        if (!tableExists) {
            console.log(
                `Table ${tableName} does not exist, skipping column change`
            );
            return;
        }

        const tableInfo = await queryInterface.describeTable(tableName);
        if (!(columnName in tableInfo)) {
            console.log(
                `Column ${columnName} does not exist in ${tableName}, skipping change`
            );
            return;
        }

        await queryInterface.changeColumn(
            tableName,
            columnName,
            columnDefinition
        );
    } catch (error) {
        console.log(
            `Migration error changing column ${columnName} on ${tableName}:`,
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
    safeChangeColumn,
};
