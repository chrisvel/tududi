'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Get current table schema
            const tableInfo = await queryInterface.describeTable('tasks');

            // Add column if it doesn't exist
            if (!('recurring_parent_id' in tableInfo)) {
                await queryInterface.addColumn('tasks', 'recurring_parent_id', {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'tasks',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                });
            }

            // Add index if it doesn't exist
            try {
                const indexes = await queryInterface.showIndex('tasks');
                const indexExists = indexes.some((index) =>
                    index.fields.some(
                        (field) => field.attribute === 'recurring_parent_id'
                    )
                );

                if (!indexExists) {
                    await queryInterface.addIndex('tasks', [
                        'recurring_parent_id',
                    ]);
                }
            } catch (indexError) {
                console.log(
                    'Could not check or add index for recurring_parent_id:',
                    indexError.message
                );
            }
        } catch (error) {
            console.log('Migration error:', error.message);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('tasks', ['recurring_parent_id']);
        await queryInterface.removeColumn('tasks', 'recurring_parent_id');
    },
};
