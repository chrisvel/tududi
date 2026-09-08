const { DataTypes } = require('sequelize');

// People who asked to be told when tududi Cloud opens. Captured by the
// marketing page, which is the only thing that writes here; the app itself
// never reads it except for the admin list.
//
// Deliberately not tied to `users`: nobody here has an account, that is the
// whole point.
module.exports = (sequelize) => {
    const WaitlistSubscriber = sequelize.define(
        'WaitlistSubscriber',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            email: {
                type: DataTypes.STRING(254),
                allowNull: false,
                unique: true,
                set(value) {
                    this.setDataValue(
                        'email',
                        String(value || '')
                            .trim()
                            .toLowerCase()
                    );
                },
                validate: { isEmail: true },
            },
            // Which form it came from: hero, waitlist, footer, cloud
            source: {
                type: DataTypes.STRING(32),
                allowNull: false,
                defaultValue: 'unknown',
            },
            locale: {
                type: DataTypes.STRING(8),
                allowNull: true,
            },
            referrer: {
                type: DataTypes.STRING(512),
                allowNull: true,
            },
            // A second submission is not a second person; it is someone
            // checking the form worked.
            submission_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
        },
        {
            tableName: 'waitlist_subscribers',
            indexes: [{ fields: ['created_at'] }],
        }
    );

    return WaitlistSubscriber;
};
