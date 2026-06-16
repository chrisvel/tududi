'use strict';

const DEFAULT_FEATURES = {
    task_intelligence_enabled: true,
    auto_suggest_next_actions_enabled: false,
    productivity_assistant_enabled: true,
    next_task_suggestion_enabled: true,
    pomodoro_enabled: true,
    eisenhower_enabled: false,
};

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('users');

        if (!tableDescription.features) {
            await queryInterface.addColumn('users', 'features', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }

        const [users] = await queryInterface.sequelize.query(
            `SELECT id,
                task_intelligence_enabled,
                auto_suggest_next_actions_enabled,
                productivity_assistant_enabled,
                next_task_suggestion_enabled,
                pomodoro_enabled,
                eisenhower_enabled
             FROM users
             WHERE features IS NULL`
        );

        for (const user of users) {
            const toBool = (v) =>
                v !== 0 && v !== false && v !== null && v !== undefined;
            const features = {
                task_intelligence_enabled: toBool(
                    user.task_intelligence_enabled
                ),
                auto_suggest_next_actions_enabled: toBool(
                    user.auto_suggest_next_actions_enabled
                ),
                productivity_assistant_enabled: toBool(
                    user.productivity_assistant_enabled
                ),
                next_task_suggestion_enabled: toBool(
                    user.next_task_suggestion_enabled
                ),
                pomodoro_enabled: toBool(user.pomodoro_enabled),
                eisenhower_enabled: toBool(user.eisenhower_enabled),
            };

            await queryInterface.sequelize.query(
                'UPDATE users SET features = :features WHERE id = :id',
                {
                    replacements: {
                        features: JSON.stringify(features),
                        id: user.id,
                    },
                }
            );
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'features');
    },
};
