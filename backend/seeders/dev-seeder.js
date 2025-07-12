const mongoose = require('mongoose');
const User = require('../models-mongo/user');
const Area = require('../models-mongo/area');
const Project = require('../models-mongo/project');
const Task = require('../models-mongo/task');
const Tag = require('../models-mongo/tag');
const Note = require('../models-mongo/note');
const InboxItem = require('../models-mongo/inbox_item');
const bcrypt = require('bcrypt');
const { createMassiveTaskData } = require('./massive-tasks');
const config = require('../config/config');

async function seedDatabase() {
    try {
        await mongoose.connect(config.mongodb_uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('🌱 Starting database seeding...');

        // Create SEPARATE test user for seeding (never overwrite existing users!)
        console.log('👤 Creating separate test user for testing...');
        const testEmail = 'test@tududi.com';

        let testUser = await User.findOne({ email: testEmail });

        if (!testUser) {
            testUser = new User({
                name: 'Test User',
                email: testEmail,
                password_digest: await bcrypt.hash('password123', 10),
                appearance: 'light',
                language: 'en',
                timezone: 'Europe/Athens',
            });
            await testUser.save();
            console.log('✅ Created new test user with ID:', testUser._id);
        } else {
            console.log('✅ Found existing test user with ID:', testUser._id);
            // Clear ONLY the test user's data to refresh it
            console.log('🧹 Clearing test user data for fresh seeding...');
            await Task.deleteMany({ user: testUser._id });
            await Project.deleteMany({ user: testUser._id });
            await Area.deleteMany({ user: testUser._id });
            await Tag.deleteMany({ user: testUser._id });
            await Note.deleteMany({ user: testUser._id });
            await InboxItem.deleteMany({ user: testUser._id });
        }

        // Create areas
        console.log('📁 Creating areas...');
        const areas = await Area.insertMany([
            { name: 'Personal', user: testUser._id },
            { name: 'Work', user: testUser._id },
            { name: 'Health & Fitness', user: testUser._id },
            { name: 'Learning', user: testUser._id },
            { name: 'Home & Family', user: testUser._id },
            { name: 'Finance', user: testUser._id },
            { name: 'Travel', user: testUser._id },
            { name: 'Hobbies', user: testUser._id },
            { name: 'Social', user: testUser._id },
            { name: 'Career', user: testUser._id },
        ]);

        // Create projects
        console.log('📂 Creating projects...');
        const projects = await Project.insertMany([
            {
                name: 'Website Redesign',
                description: 'Complete overhaul of company website',
                user: testUser._id,
                area: areas[1]._id,
                active: true,
                due_date_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
            {
                name: 'Learn React Native',
                description: 'Master mobile app development',
                user: testUser._id,
                area: areas[3]._id,
                active: true,
            },
            {
                name: 'Home Renovation',
                description: 'Kitchen and bathroom updates',
                user: testUser._id,
                area: areas[4]._id,
                active: true,
                due_date_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
            },
            {
                name: 'Fitness Challenge',
                description: '90-day fitness transformation',
                user: testUser._id,
                area: areas[2]._id,
                active: true,
                due_date_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            },
            {
                name: 'Side Business',
                description: 'Launch online consulting service',
                user: testUser._id,
                area: areas[1]._id,
                active: true,
            },
            {
                name: 'Investment Portfolio',
                description: 'Build diversified investment portfolio',
                user: testUser._id,
                area: areas[5]._id,
                active: true,
                due_date_at: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
            },
            {
                name: 'Europe Trip 2024',
                description: 'Plan and execute 3-week European vacation',
                user: testUser._id,
                area: areas[6]._id,
                active: true,
                due_date_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
            },
            {
                name: 'Photography Mastery',
                description: 'Learn advanced photography techniques',
                user: testUser._id,
                area: areas[7]._id,
                active: true,
            },
            {
                name: 'Professional Certification',
                description: 'Get AWS Solutions Architect certification',
                user: testUser._id,
                area: areas[9]._id,
                active: true,
                due_date_at: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000), // 150 days from now
            },
            {
                name: 'Garden Makeover',
                description: 'Transform backyard into productive garden',
                user: testUser._id,
                area: areas[4]._id,
                active: true,
                due_date_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
            },
            {
                name: 'Blog Launch',
                description: 'Start personal tech blog',
                user: testUser._id,
                area: areas[0]._id,
                active: true,
            },
            {
                name: 'Language Learning Spanish',
                description: 'Become conversational in Spanish',
                user: testUser._id,
                area: areas[3]._id,
                active: false, // Paused project
            },
            {
                name: 'Wedding Planning',
                description: 'Plan and organize wedding ceremony',
                user: testUser._id,
                area: areas[8]._id,
                active: true,
                due_date_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
            {
                name: 'Meal Prep System',
                description: 'Establish weekly meal preparation routine',
                user: testUser._id,
                area: areas[2]._id,
                active: true,
            },
            {
                name: 'Smart Home Setup',
                description: 'Install and configure smart home devices',
                user: testUser._id,
                area: areas[4]._id,
                active: true,
                due_date_at: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
            },
        ]);

        // Create tags
        console.log('🏷️  Creating tags...');
        const tags = await Tag.insertMany([
            { name: 'urgent', user: testUser._id },
            { name: 'quick-win', user: testUser._id },
            { name: 'research', user: testUser._id },
            { name: 'meeting', user: testUser._id },
            { name: 'creative', user: testUser._id },
            { name: 'phone-call', user: testUser._id },
            { name: 'online', user: testUser._id },
            { name: 'weekend', user: testUser._id },
            { name: 'shopping', user: testUser._id },
            { name: 'admin', user: testUser._id },
            { name: 'waiting-for', user: testUser._id },
            { name: 'someday-maybe', user: testUser._id },
            { name: 'high-energy', user: testUser._id },
            { name: 'low-energy', user: testUser._id },
            { name: 'collaboration', user: testUser._id },
            { name: 'learning', user: testUser._id },
            { name: 'maintenance', user: testUser._id },
            { name: 'financial', user: testUser._id },
            { name: 'health', user: testUser._id },
            { name: 'outdoor', user: testUser._id },
            { name: 'planning', user: testUser._id },
            { name: 'review', user: testUser._id },
            { name: 'automation', user: testUser._id },
            { name: 'documentation', user: testUser._id },
            { name: 'bug-fix', user: testUser._id },
        ]);

        // Helper function to get random date
        const getRandomDate = (daysFromNow) => {
            const randomDays = Math.floor(Math.random() * daysFromNow);
            return new Date(Date.now() + randomDays * 24 * 60 * 60 * 1000);
        };

        const getPastDate = (daysAgo) => {
            const randomDays = Math.floor(Math.random() * daysAgo);
            return new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000);
        };

        // Create tasks
        console.log('✅ Creating massive task dataset...');
        const taskData = createMassiveTaskData(
            projects,
            getRandomDate,
            getPastDate
        );

        const tasks = await Task.insertMany(taskData.map(taskInfo => ({
            ...taskInfo,
            user: testUser._id,
            note: taskInfo.note || null,
        })));

        // Create additional backlog tasks with old creation dates for realistic metrics
        console.log('📅 Creating backlog tasks with older dates...');
        const backlogTaskNames = [
            'Organize old photo albums',
            'Learn French language basics',
            'Research retirement planning options',
            'Clean out basement storage',
            'Update professional portfolio',
            'Plan career development goals',
            'Research home security systems',
            'Organize digital file system',
            'Plan vacation for next year',
            'Research new investment strategies',
            'Update emergency preparedness kit',
            'Learn new cooking techniques',
            'Research sustainable living options',
            'Plan home office reorganization',
            'Update professional headshots',
            'Research online course options',
            'Plan garden landscaping project',
            'Research new technology trends',
            'Update financial planning documents',
            'Plan family history research',
            'Research health and wellness programs',
            'Plan hobby room organization',
            'Research eco-friendly home improvements',
            'Update professional networking',
            'Plan creative writing project',
            'Research mindfulness practices',
            'Plan workshop or shed organization',
            'Research travel planning tools',
            'Update subscription management',
            'Plan digital decluttering project',
        ];

        const backlogTasks = [];
        for (let i = 0; i < backlogTaskNames.length; i++) {
            const daysAgo = Math.floor(Math.random() * 120) + 31; // 31-150 days ago
            const oldDate = new Date(
                Date.now() - daysAgo * 24 * 60 * 60 * 1000
            );

            backlogTasks.push({
                name: backlogTaskNames[i],
                priority: Math.floor(Math.random() * 3),
                status: Math.random() < 0.9 ? 0 : 1, // 90% not started, 10% in progress
                user: testUser._id,
                project:
                    Math.random() < 0.3
                        ? projects[Math.floor(Math.random() * projects.length)]
                              ._id
                        : null,
                due_date: Math.random() < 0.2 ? getRandomDate(30) : null,
                created_at: oldDate,
                updated_at: oldDate,
            });
        }
        await Task.insertMany(backlogTasks);


        // Create tasks due today for realistic "Due Today" section
        console.log('📅 Creating tasks due today...');
        const todayTaskNames = [
            'Submit weekly status report',
            'Call insurance company about claim',
            'Pick up prescription medication',
            'Schedule appointment with accountant',
            'Review and approve team proposals',
            'Prepare presentation slides for Monday',
            'Complete expense report submission',
            'Follow up on pending client emails',
            'Review contract terms and conditions',
            'Update project timeline document',
        ];

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today

        const todayTasks = [];
        for (let i = 0; i < todayTaskNames.length; i++) {
            todayTasks.push({
                name: todayTaskNames[i],
                priority: Math.floor(Math.random() * 3),
                status: Math.random() < 0.8 ? 0 : 1, // 80% not started, 20% in progress
                user: testUser._id,
                project:
                    Math.random() < 0.4
                        ? projects[Math.floor(Math.random() * projects.length)]
                              ._id
                        : null,
                due_date: today,
                created_at: getPastDate(7), // Created within last week
                updated_at: getPastDate(7),
            });
        }
        await Task.insertMany(todayTasks);

        // Create intelligent task-tag associations
        console.log('🔗 Creating intelligent task-tag associations...');

        // Helper function to tag tasks based on keywords and patterns
        const addIntelligentTags = async () => {
            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                const taskName = task.name.toLowerCase();
                const taskTags = [];

                // Pattern-based tagging for AI trigger recognition
                if (
                    taskName.includes('urgent') ||
                    taskName.includes('asap') ||
                    (task.due_date && new Date(task.due_date) < new Date())
                ) {
                    taskTags.push(tags[0]); // urgent
                }

                if (taskName.includes('call') || taskName.includes('phone')) {
                    taskTags.push(tags[5]); // phone-call
                }

                if (
                    taskName.includes('meeting') ||
                    taskName.includes('standup') ||
                    taskName.includes('conference')
                ) {
                    taskTags.push(tags[3]); // meeting
                }

                if (
                    taskName.includes('research') ||
                    taskName.includes('study') ||
                    taskName.includes('learn')
                ) {
                    taskTags.push(tags[2]); // research
                    taskTags.push(tags[15]); // learning
                }

                if (
                    taskName.includes('buy') ||
                    taskName.includes('purchase') ||
                    taskName.includes('shop')
                ) {
                    taskTags.push(tags[8]); // shopping
                }

                if (
                    taskName.includes('design') ||
                    taskName.includes('create') ||
                    taskName.includes('write') ||
                    taskName.includes('paint')
                ) {
                    taskTags.push(tags[4]); // creative
                }

                if (
                    taskName.includes('health') ||
                    taskName.includes('doctor') ||
                    taskName.includes('medical') ||
                    taskName.includes('fitness') ||
                    taskName.includes('workout')
                ) {
                    taskTags.push(tags[18]); // health
                }

                if (
                    taskName.includes('financial') ||
                    taskName.includes('budget') ||
                    taskName.includes('invest') ||
                    taskName.includes('money') ||
                    taskName.includes('pay')
                ) {
                    taskTags.push(tags[17]); // financial
                }

                if (
                    taskName.includes('outdoor') ||
                    taskName.includes('garden') ||
                    taskName.includes('hiking') ||
                    taskName.includes('park')
                ) {
                    taskTags.push(tags[19]); // outdoor
                }

                if (
                    taskName.includes('plan') ||
                    taskName.includes('schedule') ||
                    taskName.includes('organize')
                ) {
                    taskTags.push(tags[20]); // planning
                }

                if (
                    taskName.includes('review') ||
                    taskName.includes('check') ||
                    taskName.includes('audit')
                ) {
                    taskTags.push(tags[21]); // review
                }

                if (
                    taskName.includes('fix') ||
                    taskName.includes('repair') ||
                    taskName.includes('maintain') ||
                    taskName.includes('clean')
                ) {
                    taskTags.push(tags[16]); // maintenance
                }

                if (
                    taskName.includes('weekend') ||
                    (task.due_date &&
                        [0, 6].includes(new Date(task.due_date).getDay()))
                ) {
                    taskTags.push(tags[7]); // weekend
                }

                if (
                    taskName.includes('online') ||
                    taskName.includes('website') ||
                    taskName.includes('digital') ||
                    taskName.includes('app')
                ) {
                    taskTags.push(tags[6]); // online
                }

                if (task.status === 4) {
                    // waiting status
                    taskTags.push(tags[10]); // waiting-for
                }

                if (task.priority === 0 && !task.due_date) {
                    taskTags.push(tags[11]); // someday-maybe
                }

                if (
                    taskName.includes('team') ||
                    taskName.includes('group') ||
                    taskName.includes('collaborate')
                ) {
                    taskTags.push(tags[14]); // collaboration
                }

                if (
                    taskName.includes('quick') ||
                    taskName.includes('fast') ||
                    taskName.includes('simple')
                ) {
                    taskTags.push(tags[1]); // quick-win
                }

                if (
                    taskName.includes('energy') ||
                    taskName.includes('intensive') ||
                    taskName.includes('focus')
                ) {
                    taskTags.push(tags[12]); // high-energy
                }

                if (
                    taskName.includes('relax') ||
                    taskName.includes('easy') ||
                    taskName.includes('light')
                ) {
                    taskTags.push(tags[13]); // low-energy
                }

                if (
                    taskName.includes('automate') ||
                    taskName.includes('script') ||
                    taskName.includes('automation')
                ) {
                    taskTags.push(tags[22]); // automation
                }

                if (
                    taskName.includes('document') ||
                    taskName.includes('write') ||
                    taskName.includes('manual')
                ) {
                    taskTags.push(tags[23]); // documentation
                }

                if (
                    taskName.includes('bug') ||
                    taskName.includes('fix') ||
                    taskName.includes('error')
                ) {
                    taskTags.push(tags[24]); // bug-fix
                }

                // Apply tags if any were identified
                if (taskTags.length > 0) {
                    await Task.updateOne({ _id: task._id }, { $set: { tags: taskTags.map(t => t._id) } });
                }
            }
        };

        await addIntelligentTags();

        // Create task events for AI pattern learning
        console.log('📊 Creating task events for AI pattern recognition...');
        const TaskEventService = require('../services/taskEventService');

        // Create events for completed tasks to show user patterns
        const completedTasks = await Task.find({ status: 2, user: testUser._id }).limit(20);
        for (const task of completedTasks) {
            // Just first 20 to avoid too much data
            try {
                // Create task creation event
                await TaskEventService.logTaskCreated(
                    task._id,
                    testUser._id,
                    {
                        name: task.name,
                        status: 0,
                        priority: task.priority,
                        project_id: task.project,
                    },
                    { source: 'web' }
                );

                // Create status change to in_progress
                if (Math.random() < 0.7) {
                    // 70% had in_progress phase
                    await TaskEventService.logStatusChange(
                        task._id,
                        testUser._id,
                        0,
                        1,
                        { source: 'web' }
                    );
                }

                // Create completion event
                await TaskEventService.logStatusChange(
                    task._id,
                    testUser._id,
                    1,
                    2,
                    { source: 'web' }
                );
            } catch (eventError) {
                console.log(
                    `Skipping event creation for task ${task.id}: ${eventError.message}`
                );
            }
        }

        // Create events for some in-progress tasks
        const inProgressTasks = await Task.find({ status: 1, user: testUser._id }).limit(10);
        for (const task of inProgressTasks) {
            try {
                await TaskEventService.logTaskCreated(
                    task._id,
                    testUser._id,
                    {
                        name: task.name,
                        status: 0,
                        priority: task.priority,
                        project_id: task.project,
                    },
                    { source: 'web' }
                );

                await TaskEventService.logStatusChange(
                    task._id,
                    testUser._id,
                    0,
                    1,
                    { source: 'web' }
                );
            } catch (eventError) {
                console.log(
                    `Skipping event creation for task ${task.id}: ${eventError.message}`
                );
            }
        }

        // Create notes
        console.log('📝 Creating notes...');
        await Note.insertMany([
            {
                title: 'Meeting Notes - Website Redesign',
                content:
                    'Key decisions:\n- Use blue and white color scheme\n- Include customer testimonials\n- Mobile-first approach\n- Launch date: End of next month\n\nAction items:\n- Get approval from stakeholders\n- Create prototype by Friday\n- Schedule user testing session',
                user: testUser._id,
                project: projects[0]._id,
            },
            {
                title: 'React Native Learning Resources',
                content:
                    'Useful links:\n- Official documentation\n- Expo.dev for quick prototyping\n- React Navigation library\n- AsyncStorage for local data\n\nTutorials to check out:\n- React Native School\n- The Net Ninja series\n- React Native Express',
                user: testUser._id,
                project: projects[1]._id,
            },
            {
                title: 'Home Renovation Budget',
                content:
                    'Budget breakdown:\n- Kitchen: $15,000\n- Bathroom: $8,000\n- Contingency: $3,000\n- Total: $26,000\n\nContractors to contact:\n- ABC Construction: 555-0123\n- Quality Home Builders: 555-0456\n- Elite Renovations: 555-0789',
                user: testUser._id,
                project: projects[2]._id,
            },
            {
                title: 'Investment Strategy Notes',
                content:
                    'Portfolio allocation goals:\n- 60% Stock index funds\n- 30% Bond index funds\n- 10% International funds\n\nPlatforms to consider:\n- Vanguard\n- Fidelity\n- Charles Schwab\n\nMonthly investment: $1,000',
                user: testUser._id,
                project: projects[5]._id,
            },
            {
                title: 'Europe Trip Planning',
                content:
                    'Destinations:\n1. Paris, France (5 days)\n2. Rome, Italy (4 days)\n3. Barcelona, Spain (4 days)\n4. Amsterdam, Netherlands (3 days)\n5. Prague, Czech Republic (3 days)\n\nEstimated costs:\n- Flights: $1,200\n- Hotels: $2,500\n- Food: $1,000\n- Activities: $800\n- Total: $5,500',
                user: testUser._id,
                project: projects[6]._id,
            },
            {
                title: 'Photography Equipment Wishlist',
                content:
                    'Camera gear to consider:\n- Canon EOS R6 Mark II\n- 24-70mm f/2.8 lens\n- 85mm f/1.8 portrait lens\n- Tripod: Manfrotto MT055CXPRO4\n- Editing software: Lightroom + Photoshop\n\nLearning resources:\n- Sean Tucker YouTube channel\n- Peter McKinnon tutorials\n- Local photography meetups',
                user: testUser._id,
                project: projects[7]._id,
            },
            {
                title: 'Book Recommendations',
                content:
                    'To read:\n- "Deep Work" by Cal Newport\n- "The Lean Startup" by Eric Ries\n- "Atomic Habits" by James Clear\n- "Clean Code" by Robert Martin\n- "The Psychology of Money" by Morgan Housel\n- "Educated" by Tara Westover\n- "Sapiens" by Yuval Noah Harari',
                user: testUser._id,
            },
            {
                title: 'Recipe Ideas',
                content:
                    'Meals to try:\n- Mediterranean quinoa bowl\n- Thai green curry\n- Homemade pizza\n- Greek lemon chicken\n- Mushroom risotto\n- Korean bulgogi\n- Mexican street corn salad\n- Indian butter chicken\n- Japanese ramen',
                user: testUser._id,
            },
            {
                title: 'Business Ideas',
                content:
                    'Potential side businesses:\n- Web development consulting\n- Online course creation\n- Photography services\n- Productivity coaching\n- Technical writing\n\nRevenue streams to explore:\n- Subscription services\n- One-time consulting\n- Product sales\n- Affiliate marketing',
                user: testUser._id,
                project: projects[4]._id,
            },
            {
                title: 'Fitness Goals & Progress',
                content:
                    'Current stats:\n- Weight: 180 lbs\n- Body fat: 18%\n- Bench press: 185 lbs\n- Squat: 225 lbs\n- Deadlift: 275 lbs\n\nGoals (90 days):\n- Weight: 175 lbs\n- Body fat: 15%\n- Bench press: 205 lbs\n- Squat: 255 lbs\n- Deadlift: 315 lbs',
                user: testUser._id,
                project: projects[3]._id,
            },
            {
                title: 'Weekly Meal Prep Ideas',
                content:
                    'Prep schedule:\nSunday: Protein prep (chicken, fish, tofu)\nMonday: Vegetable chopping\nWednesday: Mid-week refresh\n\nMeal rotation:\n- Breakfast: Overnight oats, egg muffins\n- Lunch: Buddha bowls, salads\n- Dinner: Stir-fries, sheet pan meals\n- Snacks: Greek yogurt, nuts, fruit',
                user: testUser._id,
                project: projects[13]._id,
            },
            {
                title: 'Smart Home Device List',
                content:
                    'Devices to install:\n- Smart thermostat (Nest)\n- Smart doorbell (Ring)\n- Smart locks (August)\n- Smart lights (Philips Hue)\n- Smart speakers (Echo Dot)\n- Security cameras (Arlo)\n- Smart switches (TP-Link Kasa)\n\nEstimated cost: $2,500\nInstallation timeline: 3 weeks',
                user: testUser._id,
                project: projects[14]._id,
            },
        ]);

        // Create inbox items
        console.log('📥 Creating inbox items...');
        await InboxItem.insertMany([
            {
                content: 'Research new project management tools',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Plan team building activity for Q4',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Look into cloud storage solutions',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider learning TypeScript',
                user: testUser._id,
                status: 'processed',
            },
            {
                content: 'Update emergency contact information',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Research sustainable investing options',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Look into ergonomic desk setup',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider getting a pet',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Research meditation retreats',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Look into renewable energy for home',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider starting a podcast',
                user: testUser._id,
                status: 'processed',
            },
            {
                content: 'Research local volunteer opportunities',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Look into professional coaching',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider learning a musical instrument',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Research minimalism lifestyle',
                user: testUser._id,
                status: 'processed',
            },
            {
                content: 'Look into starting a garden',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider learning sign language',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Research passive income strategies',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Look into digital nomad lifestyle',
                user: testUser._id,
                status: 'added',
            },
            {
                content: 'Consider getting professional headshots',
                user: testUser._id,
                status: 'added',
            },
        ]);

        console.log('✨ Database seeding completed successfully!');
        console.log(`📊 Created test data for SEPARATE test user:
    - 1 test user (test@tududi.com / password123)
    - ${areas.length} areas
    - ${projects.length} projects
    - ${tasks.length + 30 + 10} tasks (including 30 backlog tasks and 10 due today)
    - ${tags.length} tags
    - 12 notes
    - 20 inbox items`);

        console.log('\n🚀 You can now:');
        console.log(
            '- Login with test@tududi.com / password123 to see test data'
        );
        console.log('- Your original account data is preserved and untouched');
        console.log('- Explore the Today view with various task statuses');
        console.log('- Test task editing, priority changes, etc.');
        console.log('- View projects with different completion states');
        console.log('- Test the task timeline feature');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        mongoose.disconnect();
    }
}

module.exports = { seedDatabase };

// Allow running directly
if (require.main === module) {
    seedDatabase()
        .then(() => {
            console.log('🏁 Seeding finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Seeding failed:', error);
            process.exit(1);
        });
}
