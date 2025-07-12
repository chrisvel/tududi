#!/usr/bin/env node

/**
 * Migration Creation Script
 * Creates a new Sequelize migration file
 * Usage: node scripts/migration-create.js <migration-name>
 */

const fs = require('fs');
const path = require('path');

function createMigration() {
    const migrationName = process.argv[2];

    if (!migrationName) {
        console.error('❌ Usage: npm run migration:create <migration-name>');
        console.error(
            'Example: npm run migration:create add-description-to-tasks'
        );
        process.exit(1);
    }

    // Generate timestamp (YYYYMMDDHHMMSS format)
    const now = new Date();
    const timestamp =
        now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

    const fileName = `${timestamp}-${migrationName}.js`;
    const filePath = path.join(__dirname, '..', 'migrations', fileName);

    // Migration template
    const template = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add your migration logic here
    // Examples:
    
    // Add a new column:
    // await queryInterface.addColumn('table_name', 'column_name', {
    //   type: Sequelize.STRING,
    //   allowNull: true
    // });
    
    // Create a new table:
    // await queryInterface.createTable('table_name', {
    //   id: {
    //     allowNull: false,
    //     autoIncrement: true,
    //     primaryKey: true,
    //     type: Sequelize.INTEGER
    //   },
    //   created_at: {
    //     allowNull: false,
    //     type: Sequelize.DATE,
    //     defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    //   },
    //   updated_at: {
    //     allowNull: false,
    //     type: Sequelize.DATE,
    //     defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    //   }
    // });
    
    // Add an index:
    // await queryInterface.addIndex('table_name', ['column_name']);
    
    throw new Error('Migration not implemented yet!');
  },

  async down(queryInterface, Sequelize) {
    // Add your rollback logic here
    // Examples:
    
    // Remove a column:
    // await queryInterface.removeColumn('table_name', 'column_name');
    
    // Drop a table:
    // await queryInterface.dropTable('table_name');
    
    // Remove an index:
    // await queryInterface.removeIndex('table_name', ['column_name']);
    
    throw new Error('Rollback not implemented yet!');
  }
};`;

    try {
        fs.writeFileSync(filePath, template);
        console.log('✅ Migration created successfully');
        console.log(`📁 File: ${fileName}`);
        console.log(`📂 Path: ${filePath}`);
        console.log('');
        console.log('📝 Next steps:');
        console.log('1. Edit the migration file to add your schema changes');
        console.log('2. Run: npm run migration:run');
        console.log('3. To rollback: npm run migration:undo');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating migration:', error.message);
        process.exit(1);
    }
}

createMigration();
