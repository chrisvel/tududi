const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^(([^<>()[\\]\\.,;:\s@\"]+(\.[^<>()[\\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            'Please add a valid email',
        ],
    },
    password_digest: {
        type: String,
        required: [true, 'Please add a password'],
    },
    appearance: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
    },
    language: {
        type: String,
        default: 'en',
    },
    timezone: {
        type: String,
        default: 'UTC',
    },
    avatar_image: {
        type: String,
    },
    telegram_bot_token: {
        type: String,
    },
    telegram_chat_id: {
        type: String,
    },
    task_summary_enabled: {
        type: Boolean,
        default: false,
    },
    task_summary_frequency: {
        type: String,
        enum: [
            'daily',
            'weekdays',
            'weekly',
            '1h',
            '2h',
            '4h',
            '8h',
            '12h',
        ],
        default: 'daily',
    },
    task_summary_last_run: {
        type: Date,
    },
    task_summary_next_run: {
        type: Date,
    },
    task_intelligence_enabled: {
        type: Boolean,
        default: true,
    },
    auto_suggest_next_actions_enabled: {
        type: Boolean,
        default: false,
    },
    pomodoro_enabled: {
        type: Boolean,
        default: true,
    },
    today_settings: {
        type: Object,
        default: {
            showMetrics: false,
            showProductivity: false,
            showIntelligence: false,
            showDueToday: true,
            showCompleted: true,
            showProgressBar: true,
            showDailyQuote: true,
        },
    },
}, {
    timestamps: true,
});

// Virtual for password (not stored in DB)
UserSchema.virtual('password').set(function (password) {
    this._password = password;
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (this._password) {
        this.password_digest = await bcrypt.hash(this._password, 10);
    }
    next();
});

// Compare password method
UserSchema.methods.checkPassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password_digest);
};

module.exports = mongoose.model('User', UserSchema);