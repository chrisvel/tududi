const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    active: {
        type: Boolean,
        required: true,
        default: false
    },
    pin_to_sidebar: {
        type: Boolean,
        required: true,
        default: false
    },
    priority: {
        type: Number,
        min: 0,
        max: 2
    },
    due_date_at: {
        type: Date
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    area: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Area'
    },
    image_url: {
        type: String
    },
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }]
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
