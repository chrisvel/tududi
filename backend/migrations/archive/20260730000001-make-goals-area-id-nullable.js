'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'goals', 'area_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'areas',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            'UPDATE goals SET area_id = 0 WHERE area_id IS NULL;'
        );
        await safeChangeColumn(queryInterface, 'goals', 'area_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'areas',
                key: 'id',
            },
        });
    },
};
