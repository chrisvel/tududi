// Helper function to create massive task data with AI feature triggers
function createMassiveTaskData(projects, getRandomDate, getPastDate) {
    // Helper to get random items from array
    const getRandomItems = (arr, count) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };

    // Helper to get random priority
    const getRandomPriority = () => Math.floor(Math.random() * 3); // 0, 1, or 2

    // Helper to get random status
    const getRandomStatus = () => {
        const statuses = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4]; // More weighted towards active tasks
        return statuses[Math.floor(Math.random() * statuses.length)];
    };

    // Productivity and work tasks
    const workTasks = [
        'Review quarterly performance metrics',
        'Update project documentation',
        'Prepare presentation for board meeting',
        'Conduct code review for new feature',
        'Write technical specification document',
        'Schedule one-on-one meetings with team',
        'Update project timeline and milestones',
        'Research new development tools',
        'Optimize database queries',
        'Create automated testing suite',
        'Refactor legacy code modules',
        'Implement security audit recommendations',
        'Design API documentation',
        'Setup continuous integration pipeline',
        'Create user acceptance testing plan',
        'Migrate data to new system',
        'Setup monitoring and alerting',
        'Write deployment procedures',
        'Create backup and recovery plan',
        'Conduct performance testing',
        'Update coding standards documentation',
        'Setup development environment',
        'Create onboarding documentation',
        'Review and update dependencies',
        'Implement feature toggles',
        'Setup load balancing',
        'Create disaster recovery plan',
        'Conduct security penetration testing',
        'Setup SSL certificates',
        'Implement caching strategy',
        'Create analytics dashboard',
        'Setup error tracking',
        'Implement rate limiting',
        'Create API versioning strategy',
        'Setup database replication',
        'Implement search functionality',
        'Create notification system',
        'Setup file upload handling',
        'Implement user authentication',
        'Create password reset functionality',
        'Setup email templates',
        'Implement data validation',
        'Create audit logging',
        'Setup health checks',
        'Implement graceful shutdowns',
    ];

    // Personal development and learning tasks
    const learningTasks = [
        'Complete online course on machine learning',
        'Read "Clean Architecture" book',
        'Practice coding challenges on LeetCode',
        'Learn advanced Git techniques',
        'Study microservices architecture',
        'Complete Docker certification',
        'Learn Kubernetes fundamentals',
        'Study system design patterns',
        'Practice algorithm problems',
        'Learn about database optimization',
        'Study network security principles',
        'Complete AWS certification',
        'Learn about blockchain technology',
        'Study DevOps best practices',
        'Learn advanced JavaScript features',
        'Study React performance optimization',
        'Learn about GraphQL',
        'Study mobile app development',
        'Learn about AI and neural networks',
        'Study cloud computing concepts',
        'Learn about containerization',
        'Study API design principles',
        'Learn about testing strategies',
        'Study agile methodologies',
        'Learn about project management',
        'Study user experience design',
        'Learn about data visualization',
        'Study cybersecurity fundamentals',
        'Learn about scalability patterns',
        'Study database design principles',
    ];

    // Health and fitness tasks
    const healthTasks = [
        'Schedule annual physical exam',
        'Book dental cleaning appointment',
        'Schedule eye exam',
        'Get blood work done',
        'Schedule dermatologist appointment',
        'Book massage therapy session',
        'Schedule physical therapy session',
        'Get flu vaccination',
        'Schedule mammogram',
        'Book nutrition consultation',
        'Schedule mental health counseling',
        'Get hearing test',
        'Schedule chiropractor appointment',
        'Book acupuncture session',
        'Schedule sleep study',
        'Get allergy testing done',
        'Schedule colonoscopy',
        'Book podiatrist appointment',
        'Schedule orthopedic consultation',
        'Get heart health screening',
        'Complete 30-minute cardio workout',
        'Do strength training session',
        'Practice yoga for 45 minutes',
        'Go for 5-mile run',
        'Complete HIIT workout',
        'Do pilates session',
        'Practice meditation for 20 minutes',
        'Track daily water intake',
        'Meal prep for the week',
        'Plan healthy breakfast options',
        'Research new workout routines',
        'Update fitness goals',
        'Track daily steps (10,000 goal)',
        'Practice breathing exercises',
        'Do stretching routine',
        'Plan weekly workout schedule',
        'Research healthy recipes',
        'Update meal planning app',
        'Schedule workout with trainer',
        'Join new fitness class',
    ];

    // Home and family tasks
    const homeTasks = [
        'Deep clean living room',
        'Organize bedroom closet',
        'Clean out garage',
        'Wash and fold laundry',
        'Vacuum all carpets',
        'Mop kitchen and bathroom floors',
        'Clean windows inside and out',
        'Organize pantry and kitchen cabinets',
        'Clean out refrigerator',
        'Wash bedsheets and pillowcases',
        'Dust all furniture',
        'Clean bathroom thoroughly',
        'Organize home office',
        'Sort through old documents',
        'Clean out car interior',
        'Wash car exterior',
        'Organize basement storage',
        'Clean air conditioning filters',
        'Test smoke detector batteries',
        'Check and clean gutters',
        'Trim bushes and hedges',
        'Water indoor plants',
        'Plant vegetables in garden',
        'Mow lawn and edge walkways',
        'Repair leaky faucet',
        'Fix squeaky door hinges',
        'Replace burnt out light bulbs',
        'Caulk bathroom tiles',
        'Touch up paint on walls',
        'Clean grout in shower',
        'Organize tool shed',
        'Season cast iron cookware',
        'Clean oven and stovetop',
        'Descale coffee maker',
        'Clean dishwasher filter',
        'Replace water filter',
        'Clean dryer vent',
        'Organize medicine cabinet',
        'Check expiration dates on medications',
        'Update emergency contact list',
    ];

    // Financial and administrative tasks
    const financialTasks = [
        'Review monthly budget',
        'Pay credit card bills',
        'Transfer money to savings',
        'Update investment portfolio',
        'Review insurance policies',
        'File tax documents',
        'Update will and testament',
        'Review retirement contributions',
        'Check credit report',
        'Update beneficiary information',
        'Review bank statements',
        'Cancel unused subscriptions',
        'Negotiate lower cable bill',
        'Shop for better car insurance',
        'Review cell phone plan',
        'Update emergency fund',
        'Research investment options',
        'Meet with financial advisor',
        'Review mortgage rates',
        'Update home insurance',
        'File warranty claims',
        'Organize receipts for taxes',
        'Update accounting software',
        'Review business expenses',
        'Pay quarterly taxes',
        'Update PayPal account',
        'Review online banking security',
        'Setup automatic bill pay',
        'Research high-yield savings',
        'Update direct deposit info',
    ];

    // Social and relationship tasks
    const socialTasks = [
        'Call parents to check in',
        'Send birthday card to friend',
        'Plan date night with partner',
        'Schedule coffee with colleague',
        'Write thank you note',
        'Plan family reunion',
        'Organize game night with friends',
        'Send holiday cards',
        'Plan surprise party',
        'Schedule lunch with mentor',
        'Join local community group',
        'Volunteer at local charity',
        'Attend networking event',
        'Plan weekend getaway',
        'Organize book club meeting',
        'Schedule video call with family',
        'Plan group hiking trip',
        'Organize potluck dinner',
        'Plan movie night',
        'Schedule catch-up with old friend',
        'Write recommendation letter',
        'Plan anniversary celebration',
        "Organize children's playdate",
        'Schedule babysitter',
        'Plan family photo session',
        'Organize neighborhood BBQ',
        'Plan holiday gathering',
        "Schedule couple's therapy",
        'Plan birthday celebration',
        'Organize team building activity',
    ];

    // Creative and hobby tasks
    const creativeeTasks = [
        'Practice guitar for 30 minutes',
        'Work on oil painting',
        'Write in journal',
        'Take photography workshop',
        'Learn new recipe',
        'Practice calligraphy',
        'Work on knitting project',
        'Write short story',
        'Learn new song on piano',
        'Practice drawing portraits',
        'Work on pottery project',
        'Edit video footage',
        'Write blog post',
        'Practice singing',
        'Work on woodworking project',
        'Learn new dance moves',
        'Practice photography techniques',
        'Work on scrapbook',
        'Write poetry',
        'Learn origami',
        'Practice sketching',
        'Work on embroidery',
        'Learn new cooking technique',
        'Practice watercolor painting',
        'Work on jewelry making',
        'Learn magic tricks',
        'Practice stand-up comedy',
        'Work on graphic design',
        'Learn new language phrases',
        'Practice mindful writing',
    ];

    // Travel and adventure tasks
    const travelTasks = [
        'Research vacation destinations',
        'Book flight tickets',
        'Reserve hotel accommodation',
        'Plan daily itinerary',
        'Apply for passport renewal',
        'Get travel insurance',
        'Exchange currency',
        'Pack suitcase',
        'Check visa requirements',
        'Update travel emergency contacts',
        'Download offline maps',
        'Research local customs',
        'Learn basic phrases',
        'Book airport parking',
        'Arrange pet sitting',
        'Stop mail delivery',
        'Set house security system',
        'Pack travel first aid kit',
        'Research local restaurants',
        'Book tours and activities',
        'Print boarding passes',
        'Check weather forecast',
        'Pack travel documents',
        'Arrange airport transportation',
        'Update travel blog',
    ];

    // All task categories combined
    const allTaskCategories = [
        ...workTasks,
        ...learningTasks,
        ...healthTasks,
        ...homeTasks,
        ...financialTasks,
        ...socialTasks,
        ...creativeeTasks,
        ...travelTasks,
    ];

    // Create base task data with existing project tasks
    const baseTaskData = [
        // Website Redesign Project (triggers collaboration, urgent deadlines)
        {
            name: 'Research competitor websites',
            project_id: projects[0].id,
            priority: 1,
            status: 2,
            completed_at: getPastDate(5),
        },
        {
            name: 'Create wireframes for homepage',
            project_id: projects[0].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Design new color palette',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Write content for About page',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Set up staging environment',
            project_id: projects[0].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(3),
        }, // Urgent deadline
        {
            name: 'Optimize images for web',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Implement responsive design',
            project_id: projects[0].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(7),
        },
        {
            name: 'Test cross-browser compatibility',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Setup Google Analytics',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Create contact form',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Write SEO meta descriptions',
            project_id: projects[0].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Design mobile navigation',
            project_id: projects[0].id,
            priority: 2,
            status: 0,
        },
        {
            name: 'Create footer section',
            project_id: projects[0].id,
            priority: 0,
            status: 0,
        },
        {
            name: 'Add social media icons',
            project_id: projects[0].id,
            priority: 0,
            status: 0,
        },
        {
            name: 'Setup SSL certificate',
            project_id: projects[0].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(2),
        }, // Very urgent

        // Europe Trip 2024 - triggers travel planning AI features
        {
            name: 'Research flight options to Paris',
            project_id: projects[6].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Book hotel in Rome',
            project_id: projects[6].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(14),
        },
        {
            name: 'Apply for European travel insurance',
            project_id: projects[6].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(30),
        },
        {
            name: 'Learn basic Italian phrases',
            project_id: projects[6].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Research train routes between cities',
            project_id: projects[6].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Plan museum visits in Paris',
            project_id: projects[6].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Book restaurant reservations',
            project_id: projects[6].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Pack European travel adapter',
            project_id: projects[6].id,
            priority: 0,
            status: 0,
        },

        // Fitness Challenge - triggers health/wellness AI features
        {
            name: 'Track daily protein intake',
            project_id: projects[3].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Complete morning cardio workout',
            project_id: projects[3].id,
            priority: 1,
            status: 2,
            completed_at: getPastDate(1),
        },
        {
            name: 'Plan weekly meal prep',
            project_id: projects[3].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Schedule body composition scan',
            project_id: projects[3].id,
            priority: 1,
            status: 0,
            due_date: getRandomDate(7),
        },
        {
            name: 'Research new workout routines',
            project_id: projects[3].id,
            priority: 0,
            status: 0,
        },
        {
            name: 'Update fitness tracker goals',
            project_id: projects[3].id,
            priority: 1,
            status: 0,
        },

        // Investment Portfolio - triggers financial AI features
        {
            name: 'Research ESG investment options',
            project_id: projects[5].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Rebalance portfolio allocation',
            project_id: projects[5].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(5),
        },
        {
            name: 'Review quarterly performance',
            project_id: projects[5].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Set up automatic dividend reinvestment',
            project_id: projects[5].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Research international market exposure',
            project_id: projects[5].id,
            priority: 0,
            status: 0,
        },

        // Side Business - triggers entrepreneurship AI features
        {
            name: 'Create business plan document',
            project_id: projects[4].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Research target market demographics',
            project_id: projects[4].id,
            priority: 2,
            status: 0,
        },
        {
            name: 'Design logo and branding',
            project_id: projects[4].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Setup business social media accounts',
            project_id: projects[4].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Register domain name',
            project_id: projects[4].id,
            priority: 2,
            status: 2,
            completed_at: getPastDate(3),
        },
        {
            name: 'Create pricing strategy',
            project_id: projects[4].id,
            priority: 2,
            status: 0,
        },
        {
            name: 'Draft service agreements',
            project_id: projects[4].id,
            priority: 1,
            status: 0,
        },

        // Home Renovation - triggers home improvement AI features
        {
            name: 'Get electrical work permit',
            project_id: projects[2].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(10),
        },
        {
            name: 'Choose bathroom tile pattern',
            project_id: projects[2].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Schedule plumbing inspection',
            project_id: projects[2].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(14),
        },
        {
            name: 'Order kitchen countertops',
            project_id: projects[2].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(21),
        },
        {
            name: 'Research energy-efficient appliances',
            project_id: projects[2].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Plan kitchen lighting layout',
            project_id: projects[2].id,
            priority: 1,
            status: 0,
        },

        // Photography Mastery - triggers creative learning AI features
        {
            name: 'Practice portrait lighting techniques',
            project_id: projects[7].id,
            priority: 1,
            status: 1,
        },
        {
            name: "Edit last weekend's photo shoot",
            project_id: projects[7].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Research local photography groups',
            project_id: projects[7].id,
            priority: 0,
            status: 0,
        },
        {
            name: 'Plan golden hour photo session',
            project_id: projects[7].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Learn advanced Lightroom techniques',
            project_id: projects[7].id,
            priority: 1,
            status: 0,
        },

        // Smart Home Setup - triggers technology AI features
        {
            name: 'Install smart thermostat',
            project_id: projects[14].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Configure home security system',
            project_id: projects[14].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(7),
        },
        {
            name: 'Setup voice assistant routines',
            project_id: projects[14].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Install smart door locks',
            project_id: projects[14].id,
            priority: 2,
            status: 0,
        },
        {
            name: 'Configure automated lighting',
            project_id: projects[14].id,
            priority: 1,
            status: 0,
        },

        // Blog Launch - triggers content creation AI features
        {
            name: 'Write first blog post about productivity',
            project_id: projects[10].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Design blog layout and theme',
            project_id: projects[10].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Setup email newsletter signup',
            project_id: projects[10].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Research SEO keywords for niche',
            project_id: projects[10].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Create content calendar for 3 months',
            project_id: projects[10].id,
            priority: 2,
            status: 0,
        },

        // Professional Certification - triggers career development AI features
        {
            name: 'Complete AWS practice exams',
            project_id: projects[8].id,
            priority: 2,
            status: 1,
        },
        {
            name: 'Schedule certification exam',
            project_id: projects[8].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(30),
        },
        {
            name: 'Review cloud architecture patterns',
            project_id: projects[8].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Practice hands-on labs',
            project_id: projects[8].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Join AWS study group',
            project_id: projects[8].id,
            priority: 0,
            status: 0,
        },

        // Meal Prep System - triggers nutrition AI features
        {
            name: 'Plan balanced weekly menu',
            project_id: projects[13].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Prep vegetables for the week',
            project_id: projects[13].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Cook batch of protein sources',
            project_id: projects[13].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Calculate macronutrient ratios',
            project_id: projects[13].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Research meal prep containers',
            project_id: projects[13].id,
            priority: 0,
            status: 0,
        },

        // Wedding Planning - triggers event planning AI features
        {
            name: 'Book wedding venue',
            project_id: projects[12].id,
            priority: 2,
            status: 2,
            completed_at: getPastDate(30),
        },
        {
            name: 'Send save the date cards',
            project_id: projects[12].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(60),
        },
        {
            name: 'Book wedding photographer',
            project_id: projects[12].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(45),
        },
        {
            name: 'Choose wedding cake flavors',
            project_id: projects[12].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Plan seating arrangement',
            project_id: projects[12].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Book honeymoon flights',
            project_id: projects[12].id,
            priority: 1,
            status: 0,
        },

        // Garden Makeover - triggers gardening/sustainability AI features
        {
            name: 'Plan vegetable garden layout',
            project_id: projects[9].id,
            priority: 1,
            status: 1,
        },
        {
            name: 'Order seeds for spring planting',
            project_id: projects[9].id,
            priority: 2,
            status: 0,
            due_date: getRandomDate(14),
        },
        {
            name: 'Install drip irrigation system',
            project_id: projects[9].id,
            priority: 1,
            status: 0,
        },
        {
            name: 'Build raised garden beds',
            project_id: projects[9].id,
            priority: 2,
            status: 0,
        },
        {
            name: 'Research companion planting',
            project_id: projects[9].id,
            priority: 0,
            status: 0,
        },
    ];

    // Generate massive additional tasks
    const massiveTasks = [];

    // Add random tasks from all categories (including old tasks for backlog)
    for (let i = 0; i < 150; i++) {
        const taskName =
            allTaskCategories[
                Math.floor(Math.random() * allTaskCategories.length)
            ];
        const hasProject = Math.random() < 0.4; // 40% chance of having a project
        const hasDueDate = Math.random() < 0.3; // 30% chance of having a due date
        const isCompleted = Math.random() < 0.08; // 8% chance of being completed

        const task = {
            name: taskName,
            priority: getRandomPriority(),
            status: isCompleted ? 2 : getRandomStatus(),
            note:
                Math.random() < 0.1
                    ? 'Added some notes during planning phase'
                    : null,
        };

        if (hasProject) {
            task.project_id =
                projects[Math.floor(Math.random() * projects.length)].id;
        }

        if (hasDueDate) {
            if (Math.random() < 0.2) {
                // 20% chance of overdue task (AI should flag these)
                task.due_date = getPastDate(Math.floor(Math.random() * 30) + 1);
            } else {
                // Future due date
                task.due_date = getRandomDate(
                    Math.floor(Math.random() * 60) + 1
                );
            }
        }

        if (isCompleted) {
            task.completed_at = getPastDate(Math.floor(Math.random() * 30) + 1);
        }

        massiveTasks.push(task);
    }

    // Add specific AI trigger tasks (tasks that should trigger intelligent suggestions)
    const aiTriggerTasks = [
        // Overdue tasks (AI should suggest prioritizing)
        {
            name: 'Submit tax documents',
            priority: 2,
            status: 0,
            due_date: getPastDate(5),
        },
        {
            name: 'Renew car registration',
            priority: 2,
            status: 0,
            due_date: getPastDate(3),
        },
        {
            name: 'Pay property taxes',
            priority: 2,
            status: 0,
            due_date: getPastDate(10),
        },
        {
            name: 'Submit insurance claim',
            priority: 2,
            status: 0,
            due_date: getPastDate(7),
        },

        // High-priority tasks with near deadlines (AI should suggest immediate action)
        {
            name: 'Prepare presentation for CEO',
            priority: 2,
            status: 0,
            due_date: getRandomDate(1),
        },
        {
            name: 'Submit project proposal',
            priority: 2,
            status: 0,
            due_date: getRandomDate(2),
        },
        {
            name: 'Complete performance review',
            priority: 2,
            status: 0,
            due_date: getRandomDate(3),
        },

        // Health-related tasks (AI should suggest wellness patterns)
        { name: 'Schedule annual checkup', priority: 1, status: 0 },
        { name: 'Get eye exam', priority: 1, status: 0 },
        { name: 'Book dental cleaning', priority: 1, status: 0 },
        { name: 'Update prescription medications', priority: 1, status: 0 },

        // Financial tasks (AI should suggest money management)
        { name: 'Review investment portfolio', priority: 1, status: 0 },
        { name: 'Update budget spreadsheet', priority: 1, status: 0 },
        {
            name: 'Research high-yield savings accounts',
            priority: 0,
            status: 0,
        },
        { name: 'Review insurance coverage', priority: 1, status: 0 },

        // Learning tasks (AI should suggest skill development)
        { name: 'Complete Python course', priority: 1, status: 1 },
        { name: 'Read industry publication', priority: 0, status: 0 },
        { name: 'Attend professional conference', priority: 1, status: 0 },
        { name: 'Update professional certifications', priority: 1, status: 0 },

        // Maintenance tasks (AI should suggest regular upkeep)
        { name: 'Change air filter in HVAC', priority: 0, status: 0 },
        { name: 'Test smoke detector batteries', priority: 1, status: 0 },
        { name: 'Backup computer files', priority: 1, status: 0 },
        {
            name: 'Update software and security patches',
            priority: 1,
            status: 0,
        },

        // Social/relationship tasks (AI should suggest work-life balance)
        { name: 'Plan anniversary dinner', priority: 1, status: 0 },
        { name: 'Call grandparents', priority: 1, status: 0 },
        { name: 'Schedule date night', priority: 0, status: 0 },
        { name: 'Organize family gathering', priority: 1, status: 0 },

        // Creative/hobby tasks (AI should suggest personal fulfillment)
        { name: 'Practice guitar daily', priority: 0, status: 0 },
        { name: 'Work on painting project', priority: 0, status: 0 },
        { name: 'Write in journal', priority: 0, status: 0 },
        { name: 'Learn new recipe', priority: 0, status: 0 },

        // Recurring daily tasks (AI should recognize patterns)
        {
            name: 'Daily meditation practice',
            priority: 1,
            status: 0,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: new Date(),
        },
        {
            name: 'Review daily priorities',
            priority: 1,
            status: 0,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: new Date(),
        },
        {
            name: 'Log daily expenses',
            priority: 0,
            status: 0,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: new Date(),
        },

        // Weekly recurring tasks
        {
            name: 'Weekly meal planning',
            priority: 1,
            status: 0,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekday: 0, // Sunday
            due_date: getRandomDate(7),
        },
        {
            name: 'Weekly house cleaning',
            priority: 1,
            status: 0,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekday: 6, // Saturday
            due_date: getRandomDate(7),
        },
        {
            name: 'Weekly team standup',
            priority: 1,
            status: 0,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekday: 1, // Monday
            due_date: getRandomDate(7),
            project_id: projects[0].id,
        },

        // Monthly recurring tasks
        {
            name: 'Monthly budget review',
            priority: 2,
            status: 0,
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 1,
            due_date: getRandomDate(30),
        },
        {
            name: 'Monthly backup verification',
            priority: 1,
            status: 0,
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: 15,
            due_date: getRandomDate(30),
        },

        // Waiting status tasks (AI should suggest follow-up actions)
        {
            name: 'Wait for contractor estimate',
            priority: 1,
            status: 4,
            project_id: projects[2].id,
        },
        { name: 'Wait for insurance approval', priority: 2, status: 4 },
        {
            name: 'Wait for vendor response',
            priority: 1,
            status: 4,
            project_id: projects[0].id,
        },
        { name: 'Wait for medical test results', priority: 1, status: 4 },
        { name: 'Wait for loan approval', priority: 2, status: 4 },

        // Recently completed tasks for learning patterns
        {
            name: 'Complete weekly workout goal',
            priority: 1,
            status: 2,
            completed_at: getPastDate(1),
            project_id: projects[3].id,
        },
        {
            name: 'Finish reading productivity book',
            priority: 0,
            status: 2,
            completed_at: getPastDate(2),
        },
        {
            name: 'Complete online course module',
            priority: 1,
            status: 2,
            completed_at: getPastDate(1),
        },
        {
            name: 'Submit weekly report',
            priority: 1,
            status: 2,
            completed_at: getPastDate(1),
            project_id: projects[0].id,
        },
        {
            name: 'Complete meal prep for week',
            priority: 1,
            status: 2,
            completed_at: getPastDate(1),
            project_id: projects[13].id,
        },
        {
            name: 'Finish monthly budget',
            priority: 1,
            status: 2,
            completed_at: getPastDate(3),
        },
        {
            name: 'Complete photography assignment',
            priority: 1,
            status: 2,
            completed_at: getPastDate(2),
            project_id: projects[7].id,
        },
        {
            name: 'Finish home organization project',
            priority: 0,
            status: 2,
            completed_at: getPastDate(4),
        },
        {
            name: 'Complete investment research',
            priority: 1,
            status: 2,
            completed_at: getPastDate(5),
            project_id: projects[5].id,
        },
        {
            name: 'Finish blog post draft',
            priority: 1,
            status: 2,
            completed_at: getPastDate(2),
            project_id: projects[10].id,
        },
    ];

    // Combine all tasks
    return [...baseTaskData, ...massiveTasks, ...aiTriggerTasks];
}

module.exports = { createMassiveTaskData };
