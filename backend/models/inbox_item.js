const mongoose = require('mongoose');

const InboxItemSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        required: true,
        default: 'added',
    },
    source: {
        type: String,
        required: true,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('InboxItem', InboxItemSchema);