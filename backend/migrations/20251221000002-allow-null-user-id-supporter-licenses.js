'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // SQLite doesn't support ALTER COLUMN directly, so we need to:
        // 1. Create a new table with the correct schema
        // 2. Copy data from old table
        // 3. Drop old table
        // 4. Rename new table

        await queryInterface.sequelize.transaction(async (transaction) => {
            // Create new table with nullable user_id
            await queryInterface.createTable(
                'supporter_licenses_new',
                {
                    id: {
                        type: Sequelize.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                    },
                    user_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true, // Changed to allow NULL
                        references: {
                            model: 'users',
                            key: 'id',
                        },
                        onDelete: 'CASCADE',
                    },
                    license_key: {
                        type: Sequelize.STRING(64),
                        allowNull: false,
                        unique: true,
                    },
                    tier: {
                        type: Sequelize.STRING(20),
                        allowNull: false,
                        defaultValue: 'bronze',
                    },
                    purchase_amount: {
                        type: Sequelize.DECIMAL(10, 2),
                        allowNull: true,
                    },
                    activated_at: {
                        type: Sequelize.DATE,
                        allowNull: true, // Also changed to nullable since it's set on activation
                    },
                    expires_at: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    revoked_at: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
                { transaction }
            );

            // Copy existing data
            await queryInterface.sequelize.query(
                `INSERT INTO supporter_licenses_new
                SELECT * FROM supporter_licenses`,
                { transaction }
            );

            // Drop old table
            await queryInterface.dropTable('supporter_licenses', {
                transaction,
            });

            // Rename new table
            await queryInterface.renameTable(
                'supporter_licenses_new',
                'supporter_licenses',
                { transaction }
            );

            // Recreate indexes
            await queryInterface.addIndex(
                'supporter_licenses',
                ['user_id'],
                {
                    name: 'supporter_licenses_user_id',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'supporter_licenses',
                ['license_key'],
                {
                    name: 'supporter_licenses_license_key',
                    unique: true,
                    transaction,
                }
            );
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert back to NOT NULL user_id
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable(
                'supporter_licenses_new',
                {
                    id: {
                        type: Sequelize.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                    },
                    user_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        references: {
                            model: 'users',
                            key: 'id',
                        },
                        onDelete: 'CASCADE',
                    },
                    license_key: {
                        type: Sequelize.STRING(64),
                        allowNull: false,
                        unique: true,
                    },
                    tier: {
                        type: Sequelize.STRING(20),
                        allowNull: false,
                        defaultValue: 'bronze',
                    },
                    purchase_amount: {
                        type: Sequelize.DECIMAL(10, 2),
                        allowNull: true,
                    },
                    activated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                    expires_at: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    revoked_at: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
                { transaction }
            );

            await queryInterface.sequelize.query(
                `INSERT INTO supporter_licenses_new
                SELECT * FROM supporter_licenses
                WHERE user_id IS NOT NULL`,
                { transaction }
            );

            await queryInterface.dropTable('supporter_licenses', {
                transaction,
            });

            await queryInterface.renameTable(
                'supporter_licenses_new',
                'supporter_licenses',
                { transaction }
            );

            await queryInterface.addIndex(
                'supporter_licenses',
                ['user_id'],
                {
                    name: 'supporter_licenses_user_id',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'supporter_licenses',
                ['license_key'],
                {
                    name: 'supporter_licenses_license_key',
                    unique: true,
                    transaction,
                }
            );
        });
    },
};
