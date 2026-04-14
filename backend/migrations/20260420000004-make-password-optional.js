'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        await queryInterface.sequelize.query('DROP TABLE IF EXISTS users_new;');

        await queryInterface.sequelize.query(`
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255),
                surname VARCHAR(255),
                email VARCHAR(255) NOT NULL UNIQUE,
                password_digest VARCHAR(255),
                appearance VARCHAR(255) NOT NULL DEFAULT 'light',
                language VARCHAR(255) NOT NULL DEFAULT 'en',
                timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
                first_day_of_week INTEGER NOT NULL DEFAULT 1,
                avatar_image VARCHAR(255),
                telegram_bot_token VARCHAR(255),
                telegram_chat_id VARCHAR(255),
                task_summary_enabled TINYINT(1) NOT NULL DEFAULT 0,
                task_summary_frequency VARCHAR(255) DEFAULT 'daily',
                task_summary_last_run DATETIME,
                task_summary_next_run DATETIME,
                telegram_allowed_users TEXT,
                task_intelligence_enabled TINYINT(1) NOT NULL DEFAULT 1,
                auto_suggest_next_actions_enabled TINYINT(1) NOT NULL DEFAULT 0,
                pomodoro_enabled TINYINT(1) NOT NULL DEFAULT 1,
                productivity_assistant_enabled TINYINT(1) NOT NULL DEFAULT 1,
                next_task_suggestion_enabled TINYINT(1) NOT NULL DEFAULT 1,
                today_settings JSON,
                sidebar_settings JSON,
                ui_settings JSON,
                notification_preferences JSON,
                keyboard_shortcuts JSON,
                email_verified TINYINT(1) NOT NULL DEFAULT 1,
                email_verification_token VARCHAR(255),
                email_verification_token_expires_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                ai_provider VARCHAR(255) NOT NULL DEFAULT 'openai',
                openai_api_key VARCHAR(255),
                ollama_base_url VARCHAR(255) DEFAULT 'http://localhost:11434',
                ollama_model VARCHAR(255) DEFAULT 'llama3'
            );
        `);

        await queryInterface.sequelize.query(`
            INSERT INTO users_new (
                id, uid, name, surname, email, password_digest, appearance, language,
                timezone, first_day_of_week, avatar_image, telegram_bot_token,
                telegram_chat_id, task_summary_enabled, task_summary_frequency,
                task_summary_last_run, task_summary_next_run, telegram_allowed_users,
                task_intelligence_enabled, auto_suggest_next_actions_enabled,
                pomodoro_enabled, productivity_assistant_enabled,
                next_task_suggestion_enabled, today_settings, sidebar_settings,
                ui_settings, notification_preferences, keyboard_shortcuts,
                email_verified, email_verification_token,
                email_verification_token_expires_at, created_at, updated_at
            )
            SELECT
                id, uid, name, surname, email,
                COALESCE(password_digest, NULL) as password_digest,
                appearance, language,
                timezone, first_day_of_week, avatar_image, telegram_bot_token,
                telegram_chat_id, task_summary_enabled, task_summary_frequency,
                task_summary_last_run, task_summary_next_run, telegram_allowed_users,
                task_intelligence_enabled, auto_suggest_next_actions_enabled,
                pomodoro_enabled, productivity_assistant_enabled,
                next_task_suggestion_enabled, today_settings, sidebar_settings,
                ui_settings, notification_preferences, keyboard_shortcuts,
                email_verified, email_verification_token,
                email_verification_token_expires_at, created_at, updated_at
            FROM users;
        `);

        await queryInterface.sequelize.query('DROP TABLE users;');

        await queryInterface.sequelize.query(
            'ALTER TABLE users_new RENAME TO users;'
        );

        await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');

        await queryInterface.sequelize.query('DROP TABLE IF EXISTS users_new;');

        await queryInterface.sequelize.query(`
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255),
                surname VARCHAR(255),
                email VARCHAR(255) NOT NULL UNIQUE,
                password_digest VARCHAR(255) NOT NULL,
                appearance VARCHAR(255) NOT NULL DEFAULT 'light',
                language VARCHAR(255) NOT NULL DEFAULT 'en',
                timezone VARCHAR(255) NOT NULL DEFAULT 'UTC',
                first_day_of_week INTEGER NOT NULL DEFAULT 1,
                avatar_image VARCHAR(255),
                telegram_bot_token VARCHAR(255),
                telegram_chat_id VARCHAR(255),
                task_summary_enabled TINYINT(1) NOT NULL DEFAULT 0,
                task_summary_frequency VARCHAR(255) DEFAULT 'daily',
                task_summary_last_run DATETIME,
                task_summary_next_run DATETIME,
                telegram_allowed_users TEXT,
                task_intelligence_enabled TINYINT(1) NOT NULL DEFAULT 1,
                auto_suggest_next_actions_enabled TINYINT(1) NOT NULL DEFAULT 0,
                pomodoro_enabled TINYINT(1) NOT NULL DEFAULT 1,
                productivity_assistant_enabled TINYINT(1) NOT NULL DEFAULT 1,
                next_task_suggestion_enabled TINYINT(1) NOT NULL DEFAULT 1,
                today_settings JSON,
                sidebar_settings JSON,
                ui_settings JSON,
                notification_preferences JSON,
                keyboard_shortcuts JSON,
                email_verified TINYINT(1) NOT NULL DEFAULT 1,
                email_verification_token VARCHAR(255),
                email_verification_token_expires_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                ai_provider VARCHAR(255) NOT NULL DEFAULT 'openai',
                openai_api_key VARCHAR(255),
                ollama_base_url VARCHAR(255) DEFAULT 'http://localhost:11434',
                ollama_model VARCHAR(255) DEFAULT 'llama3'
            );
        `);

        await queryInterface.sequelize.query(`
            INSERT INTO users_new (
                id, uid, name, surname, email, password_digest, appearance, language,
                timezone, first_day_of_week, avatar_image, telegram_bot_token,
                telegram_chat_id, task_summary_enabled, task_summary_frequency,
                task_summary_last_run, task_summary_next_run, telegram_allowed_users,
                task_intelligence_enabled, auto_suggest_next_actions_enabled,
                pomodoro_enabled, productivity_assistant_enabled,
                next_task_suggestion_enabled, today_settings, sidebar_settings,
                ui_settings, notification_preferences, keyboard_shortcuts,
                email_verified, email_verification_token,
                email_verification_token_expires_at, created_at, updated_at,
                ai_provider, openai_api_key, ollama_base_url, ollama_model
            )
            SELECT
                id, uid, name, surname, email, password_digest, appearance, language,
                timezone, first_day_of_week, avatar_image, telegram_bot_token,
                telegram_chat_id, task_summary_enabled, task_summary_frequency,
                task_summary_last_run, task_summary_next_run, telegram_allowed_users,
                task_intelligence_enabled, auto_suggest_next_actions_enabled,
                pomodoro_enabled, productivity_assistant_enabled,
                next_task_suggestion_enabled, today_settings, sidebar_settings,
                ui_settings, notification_preferences, keyboard_shortcuts,
                email_verified, email_verification_token,
                email_verification_token_expires_at, created_at, updated_at,
                ai_provider, openai_api_key, ollama_base_url, ollama_model
            FROM users;
        `);

        await queryInterface.sequelize.query('DROP TABLE users;');

        await queryInterface.sequelize.query(
            'ALTER TABLE users_new RENAME TO users;'
        );

        await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
    },
};
