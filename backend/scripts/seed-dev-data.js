const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Area = require('../models/area');
const Project = require('../models/project');
const Task = require('../models/task');
const Tag = require('../models/tag');
const Note = require('../models/note');
const InboxItem = require('../models/inbox_item');
const config = require('../config/config');

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tududi');
        console.log('MongoDB Connected for seeding');

        // Clear existing data
        await Promise.all([
            User.deleteMany(),
            Area.deleteMany(),
            Project.deleteMany(),
            Task.deleteMany(),
            Tag.deleteMany(),
            Note.deleteMany(),
            InboxItem.deleteMany(),
        ]);
        console.log('Existing data cleared.');

        // Create default user
        const hashedPassword = await bcrypt.hash('password', 10);
        const user = await User.create({
            email: 'admin@example.com',
            password_digest: hashedPassword,
            name: 'Admin User',
            timezone: 'America/New_York',
        });
        console.log('Default user created.');

        // Create some areas
        const area1 = await Area.create({ name: 'Work', user_id: user._id });
        const area2 = await Area.create({ name: 'Personal', user_id: user._id });
        console.log('Areas created.');

        // Create some projects
        const project1 = await Project.create({
            name: 'Project Alpha',
            description: 'First project for testing.',
            user_id: user._id,
            area_id: area1._id,
            active: true,
            pin_to_sidebar: true,
        });
        const project2 = await Project.create({
            name: 'Project Beta',
            description: 'Second project for testing.',
            user_id: user._id,
            area_id: area1._id,
            active: true,
        });
        const project3 = await Project.create({
            name: 'Personal Goals',
            description: 'Goals for personal development.',
            user_id: user._id,
            area_id: area2._id,
            active: true,
        });
        console.log('Projects created.');

        // Create some tags
        const tag1 = await Tag.create({ name: 'Urgent', user_id: user._id });
        const tag2 = await Tag.create({ name: 'High Priority', user_id: user._id });
        const tag3 = await Tag.create({ name: 'Someday', user_id: user._id });
        console.log('Tags created.');

        // Create some tasks
        await Task.create({
            name: 'Buy groceries',
            user_id: user._id,
            status: 0,
            priority: 2,
            today: true,
            tags: [tag1._id],
        });

        await Task.create({
            name: 'Finish report',
            user_id: user._id,
            project_id: project1._id,
            status: 1,
            priority: 1,
            due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            tags: [tag2._id],
        });

        await Task.create({
            name: 'Call John',
            user_id: user._id,
            status: 0,
            priority: 0,
            today: true,
        });

        await Task.create({
            name: 'Plan vacation',
            user_id: user._id,
            project_id: project3._id,
            status: 0,
            priority: 0,
            tags: [tag3._id],
        });

        await Task.create({
            name: 'Completed task example',
            user_id: user._id,
            status: 2,
            completed_at: new Date(),
        });
        console.log('Tasks created.');

        // Create some notes
        await Note.create({
            title: 'Meeting Notes',
            content: 'Discussed Q3 strategy and action items.',
            user_id: user._id,
            project_id: project1._id,
            tags: [tag2._id],
        });
        console.log('Notes created.');

        // Create some inbox items
        await InboxItem.create({
            content: 'New idea for app feature',
            source: 'manual',
            user_id: user._id,
        });
        console.log('Inbox items created.');

        console.log('Development data seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();