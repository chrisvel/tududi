const { nanoid } = require('nanoid');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Create conversations table
        await queryInterface.createTable('conversations', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING(36),
                unique: true,
                allowNull: false,
                defaultValue: () => nanoid(),
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            title: {
                type: Sequelize.STRING(255),
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
        });

        // Create chat_messages table
        await queryInterface.createTable('chat_messages', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING(36),
                unique: true,
                allowNull: false,
                defaultValue: () => nanoid(),
            },
            conversation_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'conversations',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            role: {
                type: Sequelize.STRING(20),
                allowNull: false,
                // role can be: 'user', 'assistant', 'system'
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            metadata: {
                type: Sequelize.TEXT,
                allowNull: true,
                // Store JSON as text (for SQLite compatibility)
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Create indexes
        await queryInterface.addIndex('conversations', ['user_id']);
        await queryInterface.addIndex('conversations', ['uid']);
        await queryInterface.addIndex('chat_messages', ['conversation_id']);
        await queryInterface.addIndex('chat_messages', ['uid']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('chat_messages');
        await queryInterface.dropTable('conversations');
    },
};
