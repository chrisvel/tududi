const mongoose = require('mongoose');

const inboxItemSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        default: 'added',
        enum: ['added', 'processed']
    },
    source: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const InboxItem = mongoose.model('InboxItem', inboxItemSchema);

module.exports = InboxItem;
