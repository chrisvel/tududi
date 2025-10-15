const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const User = sequelize.define(
        'User',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            surname: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
            },
            password: {
                type: DataTypes.VIRTUAL,
                allowNull: true,
            },
            password_digest: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'password_digest',
            },
            appearance: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'light',
                validate: {
                    isIn: [['light', 'dark']],
                },
            },
            language: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'en',
            },
            timezone: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'UTC',
            },
            first_day_of_week: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1, // Monday by default
                validate: {
                    min: 0, // Sunday
                    max: 6, // Saturday
                },
            },
            avatar_image: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            telegram_bot_token: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            telegram_chat_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            task_summary_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            task_summary_frequency: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'daily',
                validate: {
                    isIn: [
                        [
                            'daily',
                            'weekdays',
                            'weekly',
                            '1h',
                            '2h',
                            '4h',
                            '8h',
                            '12h',
                        ],
                    ],
                },
            },
            task_summary_last_run: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            task_summary_next_run: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            telegram_allowed_users: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment:
                    'Comma-separated list of allowed Telegram usernames or user IDs',
            },
            task_intelligence_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            auto_suggest_next_actions_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            pomodoro_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            productivity_assistant_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            next_task_suggestion_enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            today_settings: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    showMetrics: false,
                    showProductivity: false,
                    showNextTaskSuggestion: false,
                    showSuggestions: false,
                    showDueToday: true,
                    showCompleted: true,
                    showProgressBar: true,
                    showDailyQuote: true,
                },
            },
            sidebar_settings: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    pinnedViewsOrder: [],
                },
            },
        },
        {
            tableName: 'users',
            hooks: {
                beforeValidate: async (user) => {
                    if (user.password) {
                        user.password_digest = await bcrypt.hash(
                            user.password,
                            10
                        );
                    }
                },
            },
        }
    );

    // password operations
    const hashPassword = async (password) => {
        return await bcrypt.hash(password, 10);
    };

    const checkPassword = async (password, hashedPassword) => {
        return await bcrypt.compare(password, hashedPassword);
    };

    // Attach utility functions to model
    User.hashPassword = hashPassword;
    User.checkPassword = checkPassword;

    return User;
};
