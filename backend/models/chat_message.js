const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid');

module.exports = (sequelize) => {
    const ChatMessage = sequelize.define(
        'ChatMessage',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING(36),
                unique: true,
                allowNull: false,
                defaultValue: () => nanoid(),
            },
            conversation_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            role: {
                type: DataTypes.STRING(20),
                allowNull: false,
                // 'user', 'assistant', 'system'
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            metadata: {
                type: DataTypes.TEXT,
                allowNull: true,
                get() {
                    const value = this.getDataValue('metadata');
                    return value ? JSON.parse(value) : null;
                },
                set(value) {
                    this.setDataValue(
                        'metadata',
                        value ? JSON.stringify(value) : null
                    );
                },
            },
        },
        {
            tableName: 'chat_messages',
            underscored: true,
            timestamps: true,
            updatedAt: false, // Only track created_at
        }
    );

    ChatMessage.associate = (models) => {
        ChatMessage.belongsTo(models.Conversation, {
            foreignKey: 'conversation_id',
            as: 'conversation',
        });
    };

    return ChatMessage;
};
