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

        const dialect = queryInterface.sequelize.getDialect();

        if (dialect === 'sqlite') {
            try {
                const columns = Object.keys(tableInfo).filter(
                    (col) => col !== columnName
                );

                const columnDefs = columns
                    .map((col) => {
                        const info = tableInfo[col];
                        let def = `\`${col}\` ${info.type}`;

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
                            const defaultVal =
                                typeof info.defaultValue === 'string'
                                    ? `'${info.defaultValue.replace(/'/g, "''")}'`
                                    : info.defaultValue;
                            def += ` DEFAULT ${defaultVal}`;
                        }

                        return def;
                    })
                    .join(', ');

                const columnList = columns
                    .map((col) => `\`${col}\``)
                    .join(', ');

                await queryInterface.sequelize.query(
                    'PRAGMA foreign_keys = OFF;'
                );

                // Drop the _new table if it exists from a previous failed migration
                await queryInterface.sequelize.query(
                    `DROP TABLE IF EXISTS ${tableName}_new;`
                );

                await queryInterface.sequelize.query(
                    `CREATE TABLE ${tableName}_new (${columnDefs});`
                );

                await queryInterface.sequelize.query(
                    `INSERT INTO ${tableName}_new (${columnList}) SELECT ${columnList} FROM ${tableName};`
                );

                await queryInterface.sequelize.query(
                    `DROP TABLE ${tableName};`
                );

                await queryInterface.sequelize.query(
                    `ALTER TABLE ${tableName}_new RENAME TO ${tableName};`
                );

                await queryInterface.sequelize.query(
                    'PRAGMA foreign_keys = ON;'
                );

                console.log(
                    `Successfully removed column ${columnName} from ${tableName}`
                );
            } catch (error) {
                try {
                    await queryInterface.sequelize.query(
                        'PRAGMA foreign_keys = ON;'
                    );
                } catch (pragmaError) {}
                console.log(
                    `Migration error removing column ${columnName} from ${tableName}:`,
                    error.message
                );
                throw error;
            }
        } else {
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

function resolveDataType(definition) {
    if (!definition || !definition.type) {
        throw new Error('Column definition.type is required');
    }

    if (typeof definition.type.toSql === 'function') {
        return definition.type.toSql();
    }

    if (typeof definition.type === 'string') {
        return definition.type;
    }

    if (definition.type.key) {
        return definition.type.key;
    }

    return definition.type.toString();
}

function buildDefinitionFromInfo(columnName, info, overrideDefinition = null) {
    const parts = [`\`${columnName}\``];
    const baseInfo = overrideDefinition || {};

    const type = overrideDefinition
        ? resolveDataType(overrideDefinition)
        : info.type;
    parts.push(type);

    const primaryKey =
        overrideDefinition && 'primaryKey' in overrideDefinition
            ? overrideDefinition.primaryKey
            : info.primaryKey;
    if (primaryKey) {
        parts.push('PRIMARY KEY');
    }

    const autoIncrement =
        overrideDefinition && 'autoIncrement' in overrideDefinition
            ? overrideDefinition.autoIncrement
            : info.autoIncrement;
    if (autoIncrement) {
        parts.push('AUTOINCREMENT');
    }

    const allowNull =
        overrideDefinition && 'allowNull' in overrideDefinition
            ? overrideDefinition.allowNull
            : info.allowNull;
    if (!allowNull) {
        parts.push('NOT NULL');
    }

    const unique =
        overrideDefinition && 'unique' in overrideDefinition
            ? overrideDefinition.unique
            : info.unique;
    if (unique) {
        parts.push('UNIQUE');
    }

    const defaultValue =
        overrideDefinition && 'defaultValue' in overrideDefinition
            ? overrideDefinition.defaultValue
            : info.defaultValue;
    if (defaultValue !== undefined && defaultValue !== null) {
        const formattedDefault =
            typeof defaultValue === 'string'
                ? `'${defaultValue.replace(/'/g, "''")}'`
                : defaultValue;
        parts.push(`DEFAULT ${formattedDefault}`);
    }

    return parts.join(' ');
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

        const dialect = queryInterface.sequelize.getDialect();

        if (dialect === 'sqlite') {
            // Get indexes to determine which columns are actually individually unique
            const indexes = await queryInterface.showIndex(tableName);
            const individuallyUniqueColumns = new Set();

            indexes.forEach((index) => {
                if (index.unique && index.fields.length === 1) {
                    individuallyUniqueColumns.add(index.fields[0].attribute);
                }
            });

            const columns = Object.keys(tableInfo);
            const columnDefs = columns
                .map((col) => {
                    const info = { ...tableInfo[col] };
                    // Override the unique flag with actual index data
                    if (!individuallyUniqueColumns.has(col)) {
                        info.unique = false;
                    }
                    return buildDefinitionFromInfo(
                        col,
                        info,
                        col === columnName ? columnDefinition : null
                    );
                })
                .join(', ');

            const columnList = columns.map((col) => `\`${col}\``).join(', ');

            await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

            // Drop the _new table if it exists from a previous failed migration
            await queryInterface.sequelize.query(
                `DROP TABLE IF EXISTS ${tableName}_new;`
            );

            await queryInterface.sequelize.query(
                `CREATE TABLE ${tableName}_new (${columnDefs});`
            );

            await queryInterface.sequelize.query(
                `INSERT INTO ${tableName}_new (${columnList}) SELECT ${columnList} FROM ${tableName};`
            );

            await queryInterface.sequelize.query(`DROP TABLE ${tableName};`);

            await queryInterface.sequelize.query(
                `ALTER TABLE ${tableName}_new RENAME TO ${tableName};`
            );

            await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');

            console.log(
                `Successfully changed column ${columnName} on ${tableName}`
            );
        } else {
            await queryInterface.changeColumn(
                tableName,
                columnName,
                columnDefinition
            );
        }
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
