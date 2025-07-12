// Set test environment before importing models
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const User = require('../../models/user');
const Area = require('../../models/area');
const Project = require('../../models/project');
const Task = require('../../models/task');
const Tag = require('../../models/tag');
const Note = require('../../models/note');
const InboxItem = require('../../models/inbox_item');
const TaskEvent = require('../../models/task_event');

beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tududi_test');
}, 30000);

beforeEach(async () => {
    // Clear all collections before each test
    await Promise.all([
        User.deleteMany(),
        Area.deleteMany(),
        Project.deleteMany(),
        Task.deleteMany(),
        Tag.deleteMany(),
        Note.deleteMany(),
        InboxItem.deleteMany(),
        TaskEvent.deleteMany(),
    ]);
});

afterAll(async () => {
    await mongoose.connection.close();
}, 30000);