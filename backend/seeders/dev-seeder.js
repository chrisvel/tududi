const {
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
} = require('../models');
const bcrypt = require('bcrypt');
const { createMassiveTaskData } = require('./massive-tasks');

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        // Create SEPARATE test user for seeding (never overwrite existing users!)
        console.log('👤 Creating separate test user for testing...');
        const testEmail = 'test@tududi.com';

        let testUser = await User.findOne({ where: { email: testEmail } });

        if (!testUser) {
            testUser = await User.create({
                name: 'Test User',
                email: testEmail,
                password_digest: await bcrypt.hash('password123', 10),
                appearance: 'light',
                language: 'en',
                timezone: 'Europe/Athens',
            });
            console.log('✅ Created new test user with ID:', testUser.id);
        } else {
            console.log('✅ Found existing test user with ID:', testUser.id);
            // Clear ONLY the test user's data to refresh it
            console.log('🧹 Clearing test user data for fresh seeding...');
            await Task.destroy({ where: { user_id: testUser.id } });
            await Project.destroy({ where: { user_id: testUser.id } });
            await Area.destroy({ where: { user_id: testUser.id } });
            await Tag.destroy({ where: { user_id: testUser.id } });
            await Note.destroy({ where: { user_id: testUser.id } });
            await InboxItem.destroy({ where: { user_id: testUser.id } });
        }

        // Create areas
        console.log('📁 Creating areas...');
        const areas = await Area.bulkCreate([
            { name: 'Personal', user_id: testUser.id },
            { name: 'Work', user_id: testUser.id },
            { name: 'Health & Fitness', user_id: testUser.id },
            { name: 'Learning', user_id: testUser.id },
            { name: 'Home & Family', user_id: testUser.id },
            { name: 'Finance', user_id: testUser.id },
            { name: 'Travel', user_id: testUser.id },
            { name: 'Hobbies', user_id: testUser.id },
            { name: 'Social', user_id: testUser.id },
            { name: 'Career', user_id: testUser.id },
        ]);

        // Create projects
        console.log('📂 Creating projects...');
        const projects = await Project.bulkCreate([
            {
                name: 'Website Redesign',
                description: 'Complete overhaul of company website',
                user_id: testUser.id,
                area_id: areas[1].id,
                active: true,
                due_date_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
            {
                name: 'Learn React Native',
                description: 'Master mobile app development',
                user_id: testUser.id,
                area_id: areas[3].id,
                active: true,
            },
            {
                name: 'Home Renovation',
                description: 'Kitchen and bathroom updates',
                user_id: testUser.id,
                area_id: areas[4].id,
                active: true,
                due_date_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
            },
            {
                name: 'Fitness Challenge',
                description: '90-day fitness transformation',
                user_id: testUser.id,
                area_id: areas[2].id,
                active: true,
                due_date_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            },
            {
                name: 'Side Business',
                description: 'Launch online consulting service',
                user_id: testUser.id,
                area_id: areas[1].id,
                active: true,
            },
            {
                name: 'Investment Portfolio',
                description: 'Build diversified investment portfolio',
                user_id: testUser.id,
                area_id: areas[5].id,
                active: true,
                due_date_at: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
            },
            {
                name: 'Europe Trip 2024',
                description: 'Plan and execute 3-week European vacation',
                user_id: testUser.id,
                area_id: areas[6].id,
                active: true,
                due_date_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
            },
            {
                name: 'Photography Mastery',
                description: 'Learn advanced photography techniques',
                user_id: testUser.id,
                area_id: areas[7].id,
                active: true,
            },
            {
                name: 'Professional Certification',
                description: 'Get AWS Solutions Architect certification',
                user_id: testUser.id,
                area_id: areas[9].id,
                active: true,
                due_date_at: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000), // 150 days from now
            },
            {
                name: 'Garden Makeover',
                description: 'Transform backyard into productive garden',
                user_id: testUser.id,
                area_id: areas[4].id,
                active: true,
                due_date_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
            },
            {
                name: 'Blog Launch',
                description: 'Start personal tech blog',
                user_id: testUser.id,
                area_id: areas[0].id,
                active: true,
            },
            {
                name: 'Language Learning Spanish',
                description: 'Become conversational in Spanish',
                user_id: testUser.id,
                area_id: areas[3].id,
                active: false, // Paused project
            },
            {
                name: 'Wedding Planning',
                description: 'Plan and organize wedding ceremony',
                user_id: testUser.id,
                area_id: areas[8].id,
                active: true,
                due_date_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
            {
                name: 'Meal Prep System',
                description: 'Establish weekly meal preparation routine',
                user_id: testUser.id,
                area_id: areas[2].id,
                active: true,
            },
            {
                name: 'Smart Home Setup',
                description: 'Install and configure smart home devices',
                user_id: testUser.id,
                area_id: areas[4].id,
                active: true,
                due_date_at: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
            },
        ]);

        // Create tags
        console.log('🏷️  Creating tags...');
        const tags = await Tag.bulkCreate([
            { name: 'urgent', user_id: testUser.id },
            { name: 'quick-win', user_id: testUser.id },
            { name: 'research', user_id: testUser.id },
            { name: 'meeting', user_id: testUser.id },
            { name: 'creative', user_id: testUser.id },
            { name: 'phone-call', user_id: testUser.id },
            { name: 'online', user_id: testUser.id },
            { name: 'weekend', user_id: testUser.id },
            { name: 'shopping', user_id: testUser.id },
            { name: 'admin', user_id: testUser.id },
            { name: 'waiting-for', user_id: testUser.id },
            { name: 'someday-maybe', user_id: testUser.id },
            { name: 'high-energy', user_id: testUser.id },
            { name: 'low-energy', user_id: testUser.id },
            { name: 'collaboration', user_id: testUser.id },
            { name: 'learning', user_id: testUser.id },
            { name: 'maintenance', user_id: testUser.id },
            { name: 'financial', user_id: testUser.id },
            { name: 'health', user_id: testUser.id },
            { name: 'outdoor', user_id: testUser.id },
            { name: 'planning', user_id: testUser.id },
            { name: 'review', user_id: testUser.id },
            { name: 'automation', user_id: testUser.id },
            { name: 'documentation', user_id: testUser.id },
            { name: 'bug-fix', user_id: testUser.id },
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

        const tasks = [];
        for (const taskInfo of taskData) {
            const task = await Task.create({
                ...taskInfo,
                user_id: testUser.id,
                note: taskInfo.note || null,
            });
            tasks.push(task);
        }

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

        for (let i = 0; i < backlogTaskNames.length; i++) {
            const daysAgo = Math.floor(Math.random() * 120) + 31; // 31-150 days ago
            const oldDate = new Date(
                Date.now() - daysAgo * 24 * 60 * 60 * 1000
            );

            const backlogTask = await Task.create({
                name: backlogTaskNames[i],
                priority: Math.floor(Math.random() * 3),
                status: Math.random() < 0.9 ? 0 : 1, // 90% not started, 10% in progress
                user_id: testUser.id,
                project_id:
                    Math.random() < 0.3
                        ? projects[Math.floor(Math.random() * projects.length)]
                              .id
                        : null,
                due_date: Math.random() < 0.2 ? getRandomDate(30) : null,
                created_at: oldDate,
                updated_at: oldDate,
            });
            tasks.push(backlogTask);
        }

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

        for (let i = 0; i < todayTaskNames.length; i++) {
            const todayTask = await Task.create({
                name: todayTaskNames[i],
                priority: Math.floor(Math.random() * 3),
                status: Math.random() < 0.8 ? 0 : 1, // 80% not started, 20% in progress
                user_id: testUser.id,
                project_id:
                    Math.random() < 0.4
                        ? projects[Math.floor(Math.random() * projects.length)]
                              .id
                        : null,
                due_date: today,
                created_at: getPastDate(7), // Created within last week
                updated_at: getPastDate(7),
            });
            tasks.push(todayTask);
        }

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
                    await task.setTags(taskTags);
                }
            }
        };

        await addIntelligentTags();

        // Create task events for AI pattern learning
        console.log('📊 Creating task events for AI pattern recognition...');
        const TaskEventService = require('../services/taskEventService');

        // Create events for completed tasks to show user patterns
        const completedTasks = tasks.filter((t) => t.status === 2);
        for (const task of completedTasks.slice(0, 20)) {
            // Just first 20 to avoid too much data
            try {
                // Create task creation event
                await TaskEventService.logTaskCreated(
                    task.id,
                    testUser.id,
                    {
                        name: task.name,
                        status: 0,
                        priority: task.priority,
                        project_id: task.project_id,
                    },
                    { source: 'web' }
                );

                // Create status change to in_progress
                if (Math.random() < 0.7) {
                    // 70% had in_progress phase
                    await TaskEventService.logStatusChange(
                        task.id,
                        testUser.id,
                        0,
                        1,
                        { source: 'web' }
                    );
                }

                // Create completion event
                await TaskEventService.logStatusChange(
                    task.id,
                    testUser.id,
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
        const inProgressTasks = tasks.filter((t) => t.status === 1);
        for (const task of inProgressTasks.slice(0, 10)) {
            try {
                await TaskEventService.logTaskCreated(
                    task.id,
                    testUser.id,
                    {
                        name: task.name,
                        status: 0,
                        priority: task.priority,
                        project_id: task.project_id,
                    },
                    { source: 'web' }
                );

                await TaskEventService.logStatusChange(
                    task.id,
                    testUser.id,
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
        await Note.bulkCreate([
            {
                title: 'Meeting Notes - Website Redesign',
                content:
                    'Key decisions:\n- Use blue and white color scheme\n- Include customer testimonials\n- Mobile-first approach\n- Launch date: End of next month\n\nAction items:\n- Get approval from stakeholders\n- Create prototype by Friday\n- Schedule user testing session',
                user_id: testUser.id,
                project_id: projects[0].id,
            },
            {
                title: 'React Native Learning Resources',
                content:
                    'Useful links:\n- Official documentation\n- Expo.dev for quick prototyping\n- React Navigation library\n- AsyncStorage for local data\n\nTutorials to check out:\n- React Native School\n- The Net Ninja series\n- React Native Express',
                user_id: testUser.id,
                project_id: projects[1].id,
            },
            {
                title: 'Home Renovation Budget',
                content:
                    'Budget breakdown:\n- Kitchen: $15,000\n- Bathroom: $8,000\n- Contingency: $3,000\n- Total: $26,000\n\nContractors to contact:\n- ABC Construction: 555-0123\n- Quality Home Builders: 555-0456\n- Elite Renovations: 555-0789',
                user_id: testUser.id,
                project_id: projects[2].id,
            },
            {
                title: 'Investment Strategy Notes',
                content:
                    'Portfolio allocation goals:\n- 60% Stock index funds\n- 30% Bond index funds\n- 10% International funds\n\nPlatforms to consider:\n- Vanguard\n- Fidelity\n- Charles Schwab\n\nMonthly investment: $1,000',
                user_id: testUser.id,
                project_id: projects[5].id,
            },
            {
                title: 'Europe Trip Planning',
                content:
                    'Destinations:\n1. Paris, France (5 days)\n2. Rome, Italy (4 days)\n3. Barcelona, Spain (4 days)\n4. Amsterdam, Netherlands (3 days)\n5. Prague, Czech Republic (3 days)\n\nEstimated costs:\n- Flights: $1,200\n- Hotels: $2,500\n- Food: $1,000\n- Activities: $800\n- Total: $5,500',
                user_id: testUser.id,
                project_id: projects[6].id,
            },
            {
                title: 'Photography Equipment Wishlist',
                content:
                    'Camera gear to consider:\n- Canon EOS R6 Mark II\n- 24-70mm f/2.8 lens\n- 85mm f/1.8 portrait lens\n- Tripod: Manfrotto MT055CXPRO4\n- Editing software: Lightroom + Photoshop\n\nLearning resources:\n- Sean Tucker YouTube channel\n- Peter McKinnon tutorials\n- Local photography meetups',
                user_id: testUser.id,
                project_id: projects[7].id,
            },
            {
                title: 'Book Recommendations',
                content:
                    'To read:\n- "Deep Work" by Cal Newport\n- "The Lean Startup" by Eric Ries\n- "Atomic Habits" by James Clear\n- "Clean Code" by Robert Martin\n- "The Psychology of Money" by Morgan Housel\n- "Educated" by Tara Westover\n- "Sapiens" by Yuval Noah Harari',
                user_id: testUser.id,
            },
            {
                title: 'Recipe Ideas',
                content:
                    'Meals to try:\n- Mediterranean quinoa bowl\n- Thai green curry\n- Homemade pizza\n- Greek lemon chicken\n- Mushroom risotto\n- Korean bulgogi\n- Mexican street corn salad\n- Indian butter chicken\n- Japanese ramen',
                user_id: testUser.id,
            },
            {
                title: 'Business Ideas',
                content:
                    'Potential side businesses:\n- Web development consulting\n- Online course creation\n- Photography services\n- Productivity coaching\n- Technical writing\n\nRevenue streams to explore:\n- Subscription services\n- One-time consulting\n- Product sales\n- Affiliate marketing',
                user_id: testUser.id,
                project_id: projects[4].id,
            },
            {
                title: 'Fitness Goals & Progress',
                content:
                    'Current stats:\n- Weight: 180 lbs\n- Body fat: 18%\n- Bench press: 185 lbs\n- Squat: 225 lbs\n- Deadlift: 275 lbs\n\nGoals (90 days):\n- Weight: 175 lbs\n- Body fat: 15%\n- Bench press: 205 lbs\n- Squat: 255 lbs\n- Deadlift: 315 lbs',
                user_id: testUser.id,
                project_id: projects[3].id,
            },
            {
                title: 'Weekly Meal Prep Ideas',
                content:
                    'Prep schedule:\nSunday: Protein prep (chicken, fish, tofu)\nMonday: Vegetable chopping\nWednesday: Mid-week refresh\n\nMeal rotation:\n- Breakfast: Overnight oats, egg muffins\n- Lunch: Buddha bowls, salads\n- Dinner: Stir-fries, sheet pan meals\n- Snacks: Greek yogurt, nuts, fruit',
                user_id: testUser.id,
                project_id: projects[13].id,
            },
            {
                title: 'Smart Home Device List',
                content:
                    'Devices to install:\n- Smart thermostat (Nest)\n- Smart doorbell (Ring)\n- Smart locks (August)\n- Smart lights (Philips Hue)\n- Smart speakers (Echo Dot)\n- Security cameras (Arlo)\n- Smart switches (TP-Link Kasa)\n\nEstimated cost: $2,500\nInstallation timeline: 3 weeks',
                user_id: testUser.id,
                project_id: projects[14].id,
            },
        ]);

        // Create inbox items
        console.log('📥 Creating inbox items...');
        await InboxItem.bulkCreate([
            {
                content: 'Research new project management tools',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Plan team building activity for Q4',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Look into cloud storage solutions',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider learning TypeScript',
                user_id: testUser.id,
                processed: true,
            },
            {
                content: 'Update emergency contact information',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Research sustainable investing options',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Look into ergonomic desk setup',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider getting a pet',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Research meditation retreats',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Look into renewable energy for home',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider starting a podcast',
                user_id: testUser.id,
                processed: true,
            },
            {
                content: 'Research local volunteer opportunities',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Look into professional coaching',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider learning a musical instrument',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Research minimalism lifestyle',
                user_id: testUser.id,
                processed: true,
            },
            {
                content: 'Look into starting a garden',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider learning sign language',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Research passive income strategies',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Look into digital nomad lifestyle',
                user_id: testUser.id,
                processed: false,
            },
            {
                content: 'Consider getting professional headshots',
                user_id: testUser.id,
                processed: false,
            },
        ]);

        console.log('✨ Database seeding completed successfully!');
        console.log(`📊 Created test data for SEPARATE test user:
    - 1 test user (test@tududi.com / password123)
    - ${areas.length} areas
    - ${projects.length} projects
    - ${tasks.length} tasks (including 30 backlog tasks and 10 due today)
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
