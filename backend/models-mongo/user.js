const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    password_digest: {
        type: String,
        required: true
    },
    appearance: {
        type: String,
        required: true,
        default: 'light',
        enum: ['light', 'dark']
    },
    language: {
        type: String,
        required: true,
        default: 'en'
    },
    timezone: {
        type: String,
        required: true,
        default: 'UTC'
    },
    avatar_image: {
        type: String
    },
    telegram_bot_token: {
        type: String
    },
    telegram_chat_id: {
        type: String
    },
    task_summary_enabled: {
        type: Boolean,
        required: true,
        default: false
    },
    task_summary_frequency: {
        type: String,
        default: 'daily',
        enum: ['daily', 'weekdays', 'weekly', '1h', '2h', '4h', '8h', '12h']
    },
    task_summary_last_run: {
        type: Date
    },
    task_summary_next_run: {
        type: Date
    },
    task_intelligence_enabled: {
        type: Boolean,
        required: true,
        default: true
    },
    auto_suggest_next_actions_enabled: {
        type: Boolean,
        required: true,
        default: false
    },
    pomodoro_enabled: {
        type: Boolean,
        required: true,
        default: true
    },
    today_settings: {
        showMetrics: { type: Boolean, default: false },
        showProductivity: { type: Boolean, default: false },
        showIntelligence: { type: Boolean, default: false },
        showDueToday: { type: Boolean, default: true },
        showCompleted: { type: Boolean, default: true },
        showProgressBar: { type: Boolean, default: true },
        showDailyQuote: { type: Boolean, default: true }
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

userSchema.virtual('password').set(function(password) {
    this._password = password;
});

userSchema.pre('validate', async function(next) {
    if (this._password) {
        this.password_digest = await bcrypt.hash(this._password, 10);
    }
    next();
});

userSchema.statics.hashPassword = async function(password) {
    return await bcrypt.hash(password, 10);
};

userSchema.methods.checkPassword = async function(password) {
    return await bcrypt.compare(password, this.password_digest);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
