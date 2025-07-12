const mongoose = require('mongoose');

const CalendarTokenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    provider: {
        type: String,
        required: true,
        default: 'google',
    },
    access_token: {
        type: String,
        required: true,
    },
    refresh_token: {
        type: String,
    },
    token_type: {
        type: String,
        default: 'Bearer',
    },
    expires_at: {
        type: Date,
    },
    scope: {
        type: String,
    },
    connected_email: {
        type: String,
    },
}, {
    timestamps: true,
});

CalendarTokenSchema.index({ user_id: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('CalendarToken', CalendarTokenSchema);