const { DataTypes } = require('sequelize');

// An account email tududi sent, or tried to send, to a user: which one
// (`email`, a name from backend/emails, and `variant`, such as the days left
// in a trial reminder), in which language, and whether it went out.
// `triggered_by_user_id` is the admin who sent it by hand; null means the app
// sent it on its own.
module.exports = (sequelize) => {
    const EmailDelivery = sequelize.define(
        'EmailDelivery',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            email: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            variant: {
                type: DataTypes.STRING(32),
                allowNull: true,
            },
            recipient: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            subject: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },
            language: {
                type: DataTypes.STRING(8),
                allowNull: false,
            },
            // 'sent' or 'failed'
            status: {
                type: DataTypes.STRING(16),
                allowNull: false,
            },
            error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            triggered_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
            },
        },
        {
            tableName: 'email_deliveries',
            updatedAt: false,
            indexes: [
                {
                    fields: ['user_id', 'created_at'],
                    name: 'email_deliveries_user_created',
                },
            ],
        }
    );

    return EmailDelivery;
};
