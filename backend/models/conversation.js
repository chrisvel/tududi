const { DataTypes } = require('sequelize');
const { nanoid } = require('nanoid');

module.exports = (sequelize) => {
    const Conversation = sequelize.define(
        'Conversation',
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
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
        },
        {
            tableName: 'conversations',
            underscored: true,
            timestamps: true,
        }
    );

    Conversation.associate = (models) => {
        Conversation.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user',
        });
        Conversation.hasMany(models.ChatMessage, {
            foreignKey: 'conversation_id',
            as: 'messages',
        });
    };

    return Conversation;
};
