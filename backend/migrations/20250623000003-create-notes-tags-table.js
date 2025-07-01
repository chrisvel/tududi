'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if notes_tags table exists
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('notes_tags')) {
            await queryInterface.createTable('notes_tags', {
                note_id: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: 'notes',
                        key: 'id',
                    },
                    onDelete: 'CASCADE',
                },
                tag_id: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: 'tags',
                        key: 'id',
                    },
                    onDelete: 'CASCADE',
                },
                created_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
                updated_at: {
                    allowNull: false,
                    type: Sequelize.DATE,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            });

            // Add unique index
            await queryInterface.addIndex('notes_tags', ['note_id', 'tag_id'], {
                unique: true,
                name: 'notes_tags_unique_idx',
            });
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('notes_tags');
    },
};
