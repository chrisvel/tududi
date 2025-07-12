const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    active: {
        type: Boolean,
        default: false,
    },
    pin_to_sidebar: {
        type: Boolean,
        default: false,
    },
    priority: {
        type: Number,
        min: 0,
        max: 2,
    },
    due_date_at: {
        type: Date,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    area_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Area',
    },
    image_url: {
        type: String,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Project', ProjectSchema);