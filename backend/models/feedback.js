const { DataTypes } = require('sequelize');

// Bug reports and suggestions sent from the bug icon in the sidebar footer.
// Only admins read them, on /admin/feedback. Rows go with the account that
// sent them, like everything else a user writes.
module.exports = (sequelize) => {
    const Feedback = sequelize.define(
        'Feedback',
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
                onDelete: 'CASCADE',
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            // Where the sender was when they opened the form, which is
            // usually where the problem is.
            page_url: {
                type: DataTypes.STRING(512),
                allowNull: true,
            },
            user_agent: {
                type: DataTypes.STRING(512),
                allowNull: true,
            },
            app_version: {
                type: DataTypes.STRING(32),
                allowNull: true,
            },
            resolved_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'feedback',
            indexes: [{ fields: ['user_id'] }, { fields: ['created_at'] }],
        }
    );

    return Feedback;
};
