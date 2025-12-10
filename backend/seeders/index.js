require('dotenv').config();
const bcrypt = require('bcrypt');
const slugify = require('slugify');
const { faker } = require('@faker-js/faker');
const {
    User,
    Area,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    Role,
} = require('../models');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STATUS_LOOKUP = {
    scheduled: 0,
    planned: 0,
    todo: 0,
    'not-started': 0,
    'in_progress': 1,
    'in-progress': 1,
    active: 1,
    started: 1,
    completed: 2,
    done: 2,
    finished: 2,
    deferred: 3,
    snoozed: 3,
    waiting: 4,
    blocked: 4,
};

const PRIORITY_LOOKUP = {
    low: 0,
    normal: 1,
    medium: 1,
    focus: 1,
    high: 2,
    critical: 2,
};

const toFutureDate = (days) => {
    if (typeof days !== 'number') {
        return null;
    }

    const base = new Date();
    base.setHours(9, 0, 0, 0);
    return new Date(base.getTime() + days * DAY_IN_MS);
};

const toPastDate = (days, fallbackToNow = false) => {
    if (typeof days !== 'number') {
        return fallbackToNow ? new Date() : null;
    }

    const base = new Date();
    base.setHours(9, 0, 0, 0);
    return new Date(base.getTime() - days * DAY_IN_MS);
};

const mapStatus = (value) => {
    if (typeof value === 'number') {
        return value;
    }

    if (!value) {
        return 0;
    }

    const normalized = value.toString().toLowerCase().replace(/\s+/g, '-');
    return STATUS_LOOKUP[normalized] ?? 0;
};

const mapPriority = (value) => {
    if (typeof value === 'number') {
        return value;
    }

    if (!value) {
        return 1;
    }

    const normalized = value.toString().toLowerCase();
    return PRIORITY_LOOKUP[normalized] ?? 1;
};

const cleanupUserData = async (userId) => {
    await Task.destroy({ where: { user_id: userId } });
    await Note.destroy({ where: { user_id: userId } });
    await InboxItem.destroy({ where: { user_id: userId } });
    await Project.destroy({ where: { user_id: userId } });
    await Area.destroy({ where: { user_id: userId } });
    await Tag.destroy({ where: { user_id: userId } });
};

const upsertUser = async (profile) => {
    const hashedPassword = await bcrypt.hash(profile.password, 10);

    let user = await User.findOne({ where: { email: profile.email } });

    if (!user) {
        user = await User.create({
            name: profile.name,
            surname: profile.surname,
            email: profile.email,
            password_digest: hashedPassword,
            appearance: profile.appearance || 'light',
            language: profile.language || 'en',
            timezone: profile.timezone || 'UTC',
            first_day_of_week: profile.first_day_of_week ?? 1,
        });
    } else {
        await user.update({
            name: profile.name || user.name,
            surname: profile.surname || user.surname,
            password_digest: hashedPassword,
            appearance: profile.appearance || user.appearance,
            language: profile.language || user.language,
            timezone: profile.timezone || user.timezone,
            first_day_of_week:
                profile.first_day_of_week ?? user.first_day_of_week,
        });
    }

    const [role] = await Role.findOrCreate({
        where: { user_id: user.id },
        defaults: {
            user_id: user.id,
            is_admin: Boolean(profile.is_admin),
        },
    });

    if (profile.is_admin && !role.is_admin) {
        role.is_admin = true;
        await role.save();
    }

    return user;
};

const createAreas = async (userId, areas = []) => {
    const areaMap = new Map();

    for (const area of areas) {
        const slug =
            area.slug ||
            slugify(area.name || 'area', {
                lower: true,
                strict: true,
            });

        const record = await Area.create({
            name: area.name,
            description: area.description || null,
            user_id: userId,
        });

        areaMap.set(slug, record);
    }

    return areaMap;
};

const createTags = async (userId, tags = []) => {
    const tagMap = new Map();
    for (const tag of tags) {
        const slug =
            tag.slug ||
            slugify(tag.name || 'tag', {
                lower: true,
                strict: true,
            });
        const record = await Tag.create({
            name: tag.name,
            user_id: userId,
        });
        tagMap.set(slug, record);
    }
    return tagMap;
};

const createProjects = async (userId, projectDefs = [], areaMap = new Map()) => {
    const projectMap = new Map();

    for (const def of projectDefs) {
        const slug =
            def.slug ||
            slugify(def.name || 'project', {
                lower: true,
                strict: true,
            });

        const project = await Project.create({
            name: def.name,
            description: def.description || null,
            pin_to_sidebar: Boolean(def.pin_to_sidebar),
            priority: def.priority ?? null,
            due_date_at: toFutureDate(def.dueInDays),
            user_id: userId,
            area_id: def.area ? areaMap.get(def.area)?.id ?? null : null,
            state: def.state || 'planned',
            image_url: def.image_url || null,
        });

        projectMap.set(slug, project);
    }

    return projectMap;
};

const attachTags = async (entity, tagSlugs = [], tagMap = new Map()) => {
    if (!Array.isArray(tagSlugs) || tagSlugs.length === 0) {
        return;
    }

    const records = tagSlugs
        .map((slug) => tagMap.get(slug))
        .filter(Boolean);

    if (records.length === 0 || typeof entity.setTags !== 'function') {
        return;
    }

    await entity.setTags(records);
};

const createTasks = async (
    taskDefs = [],
    context,
    parentTask = null,
    defaultProjectSlug = null
) => {
    for (let index = 0; index < taskDefs.length; index += 1) {
        const def = taskDefs[index];
        const projectSlug =
            def.project || defaultProjectSlug || context.defaultProjectSlug;
        const projectRecord = projectSlug
            ? context.projectMap.get(projectSlug)
            : null;

        const resolvedStatus = mapStatus(def.status);
        const dueDate = toFutureDate(def.dueInDays);
        const deferUntil = toFutureDate(def.deferInDays);
        const createdAt = toPastDate(def.createdAgoDays);
        const completedAt =
            resolvedStatus === 2
                ? toPastDate(def.completedAgoDays, true)
                : null;

        const payload = {
            name: def.name,
            description: def.description || null,
            note: def.note || null,
            today: Boolean(def.today),
            priority: mapPriority(def.priority),
            status: resolvedStatus,
            user_id: context.userId,
            project_id: projectRecord ? projectRecord.id : null,
            due_date: dueDate,
            defer_until: deferUntil,
            parent_task_id: parentTask ? parentTask.id : null,
            order: parentTask ? index : def.order ?? null,
            completed_at: completedAt,
        };

        if (createdAt) {
            payload.created_at = createdAt;
            payload.updated_at = createdAt;
        }

        const task = await Task.create(payload);
        context.stats.tasks += 1;

        await attachTags(task, def.tags, context.tagMap);

        if (Array.isArray(def.subtasks) && def.subtasks.length > 0) {
            await createTasks(def.subtasks, context, task, projectSlug);
        }
    }
};

const createNotes = async (noteDefs = [], context) => {
    for (const note of noteDefs) {
        const project =
            note.project && context.projectMap.get(note.project)
                ? context.projectMap.get(note.project)
                : null;

        const record = await Note.create({
            title: note.title || null,
            content: note.content || null,
            user_id: context.userId,
            project_id: project ? project.id : null,
        });

        context.stats.notes += 1;
        await attachTags(record, note.tags, context.tagMap);
    }
};

const createInboxItems = async (items = [], userId, stats, projectMap = new Map(), tagMap = new Map()) => {
    for (const item of items) {
        await InboxItem.create({
            title: item.title || null,
            content: item.content,
            source: item.source || 'seed',
            status: item.status || 'added',
            suggested_type: item.suggested_type || null,
            suggested_reason: item.suggested_reason || null,
            parsed_tags: item.parsed_tags || null,
            parsed_projects: item.parsed_projects || null,
            cleaned_content: item.cleaned_content || null,
            user_id: userId,
        });

        stats.inbox += 1;
    }
};

/**
 * Realistic English task templates
 */
const taskTemplates = {
    work: [
        'Review quarterly budget report',
        'Prepare presentation for client meeting',
        'Update project documentation',
        'Schedule team standup for next week',
        'Follow up on pending invoices',
        'Review pull request for new feature',
        'Conduct code review for API changes',
        'Test new deployment pipeline',
        'Write meeting notes from strategy session',
        'Update stakeholder on project progress',
        'Research competitor products',
        'Draft proposal for new initiative',
        'Review and approve expense reports',
        'Onboard new team member',
        'Update project timeline',
    ],
    personal: [
        'Book dentist appointment',
        'Renew car insurance',
        'Plan weekend hiking trip',
        'Order birthday gift for mom',
        'Schedule annual physical checkup',
        'Organize closet and donate old clothes',
        'Research vacation destinations',
        'Pay utility bills',
        'Call plumber to fix leak',
        'Pick up dry cleaning',
        'Meal prep for next week',
        'Update emergency contact list',
        'Review investment portfolio',
        'Clean out garage',
        'Plan family game night',
    ],
    health: [
        'Go for 30-minute morning walk',
        'Complete workout routine',
        'Track daily water intake',
        'Prepare healthy lunch for tomorrow',
        'Book yoga class',
        'Get 8 hours of sleep tonight',
        'Take vitamin supplements',
        'Meditate for 15 minutes',
        'Stretch after work',
        'Cook dinner instead of ordering',
    ],
    learning: [
        'Complete online course module',
        'Read chapter on design patterns',
        'Practice coding challenge',
        'Watch tutorial on new framework',
        'Review language flashcards',
        'Attend webinar on industry trends',
        'Listen to educational podcast',
        'Take notes from conference talk',
        'Write blog post about recent learning',
        'Join online study group',
    ],
};

const projectTemplates = [
    { name: 'Website Redesign', desc: 'Modernize company website with new design system' },
    { name: 'Mobile App Launch', desc: 'Build and release iOS and Android apps' },
    { name: 'Q4 Marketing Campaign', desc: 'Plan and execute end-of-year marketing push' },
    { name: 'Customer Support Improvement', desc: 'Streamline support workflows and reduce response time' },
    { name: 'Home Renovation', desc: 'Update kitchen and bathroom' },
    { name: 'Fitness Challenge', desc: '90-day health and fitness program' },
    { name: 'Learn Spanish', desc: 'Achieve conversational fluency in 6 months' },
    { name: 'Personal Finance Audit', desc: 'Review and optimize budget and investments' },
    { name: 'API Integration', desc: 'Connect third-party services to platform' },
    { name: 'Database Migration', desc: 'Move from legacy database to new system' },
    { name: 'Team Building Initiative', desc: 'Improve team collaboration and morale' },
    { name: 'Content Creation Strategy', desc: 'Develop consistent content pipeline' },
    { name: 'Garden Planning', desc: 'Design and plant vegetable garden' },
    { name: 'Book Writing Project', desc: 'Write and publish first book' },
    { name: 'Certification Prep', desc: 'Study for professional certification exam' },
];

const noteTemplates = [
    { title: 'Meeting Notes: Weekly Sync', content: 'Discussed progress on current sprint. Team velocity is improving. Need to address technical debt in authentication module. Action items assigned to relevant team members.' },
    { title: 'Ideas for Blog Post', content: 'Topics to explore:\n- Best practices for remote team collaboration\n- Time management tips for busy professionals\n- How to set effective goals\n- Productivity tools worth trying' },
    { title: 'Reading List', content: 'Books to read:\n- Atomic Habits by James Clear\n- Deep Work by Cal Newport\n- The Lean Startup by Eric Ries\n- Thinking, Fast and Slow by Daniel Kahneman' },
    { title: 'Recipe: Quick Weeknight Dinner', content: 'Ingredients: chicken, vegetables, rice, soy sauce\nPrep time: 15 minutes\nCook time: 25 minutes\nPerfect for busy evenings when time is limited.' },
    { title: 'Project Retrospective', content: 'What went well: Team communication improved, feature shipped on time\nWhat to improve: Need better testing coverage, code reviews took too long\nAction items: Set up automated testing, create review checklist' },
    { title: 'Travel Planning Notes', content: 'Destination ideas: Japan in spring, Iceland in summer, New Zealand in fall\nBudget: $3000-4000\nDuration: 2 weeks\nResearch visa requirements and book flights early' },
    { title: 'Workout Routine', content: 'Monday: Upper body strength\nWednesday: Cardio and core\nFriday: Lower body strength\nSaturday: Yoga or stretching\nRest days: Tuesday, Thursday, Sunday' },
    { title: 'Learning Resources', content: 'Online courses: Coursera, Udemy, LinkedIn Learning\nCoding practice: LeetCode, HackerRank\nBooks: Safari Books Online\nCommunities: Stack Overflow, Reddit' },
];

const inboxTemplates = [
    { content: 'Check if the marketing team needs help with the launch event', source: 'email' },
    { content: 'Remember to update LinkedIn profile', source: 'mobile' },
    { content: 'Research best practices for remote onboarding', source: 'slack' },
    { content: 'Call Sarah about the weekend plans', source: 'mobile' },
    { content: 'Review contract before signing', source: 'email' },
    { content: 'Buy groceries: milk, eggs, bread, vegetables', source: 'voice' },
    { content: 'Schedule quarterly review with manager', source: 'slack' },
    { content: 'Compare prices for new laptop', source: 'web' },
    { content: 'Send thank you note to client', source: 'email' },
    { content: 'Check warranty on broken appliance', source: 'mobile' },
    { content: 'Research daycare options', source: 'web' },
    { content: 'Follow up with recruiter', source: 'email' },
    { content: 'Update emergency contact information', source: 'mobile' },
    { content: 'Look into continuing education courses', source: 'web' },
    { content: 'Plan anniversary surprise', source: 'mobile' },
];

/**
 * Generate a random blueprint using faker
 */
const generateRandomBlueprint = () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    // Generate random areas
    const areaThemes = [
        { name: 'Product Development', desc: 'Building and shipping features' },
        { name: 'Team Operations', desc: 'Managing team processes and rituals' },
        { name: 'Personal Growth', desc: 'Learning and self-improvement' },
        { name: 'Health & Wellness', desc: 'Physical and mental wellbeing' },
        { name: 'Creative Projects', desc: 'Writing, design, and creative work' },
        { name: 'Business Strategy', desc: 'Planning and decision making' },
        { name: 'Client Relations', desc: 'Customer and partner interactions' },
        { name: 'Finance & Admin', desc: 'Budget, expenses, and operations' },
    ];

    const numAreas = faker.number.int({ min: 2, max: 4 });
    const selectedAreaThemes = faker.helpers.arrayElements(areaThemes, numAreas);
    const areas = selectedAreaThemes.map((theme, idx) => ({
        slug: slugify(theme.name, { lower: true, strict: true }),
        name: theme.name,
        description: theme.desc,
    }));

    // Generate random tags
    const tagNames = [
        'Meeting', 'Writing', 'Focus', 'Review', 'Planning', 'Research',
        'Urgent', 'Follow-up', 'Quick-win', 'Automation', 'Design',
        'Development', 'Testing', 'Documentation', 'Learning', 'Health',
        'Personal', 'Finance', 'Travel', 'Communication'
    ];
    const numTags = faker.number.int({ min: 6, max: 12 });
    const selectedTags = faker.helpers.arrayElements(tagNames, numTags);
    const tags = selectedTags.map(name => ({
        slug: slugify(name, { lower: true, strict: true }),
        name,
    }));

    // Generate random projects
    const numProjects = faker.number.int({ min: 3, max: 5 });
    const projects = [];
    const projectStates = ['idea', 'planned', 'in_progress', 'blocked', 'completed'];
    const priorities = [null, 0, 1, 2];
    const selectedProjects = faker.helpers.arrayElements(projectTemplates, numProjects);

    for (let i = 0; i < numProjects; i++) {
        const projectTemplate = selectedProjects[i];
        const areaSlug = faker.helpers.maybe(() => faker.helpers.arrayElement(areas).slug, { probability: 0.7 });
        const state = faker.helpers.arrayElement(projectStates);
        const hasDueDate = faker.helpers.maybe(() => true, { probability: 0.6 });

        const project = {
            slug: slugify(projectTemplate.name, { lower: true, strict: true }),
            name: projectTemplate.name,
            description: projectTemplate.desc,
            area: areaSlug,
            state,
            dueInDays: hasDueDate ? faker.number.int({ min: -5, max: 30 }) : null,
            pin_to_sidebar: faker.datatype.boolean(0.3),
            priority: faker.helpers.arrayElement(priorities),
            image_url: faker.image.urlPicsumPhotos({ width: 800, height: 400 }),
            tasks: [],
        };

        // Generate tasks for this project
        const numTasks = faker.number.int({ min: 3, max: 8 });
        const allTaskTemplates = [
            ...taskTemplates.work,
            ...taskTemplates.personal,
            ...taskTemplates.health,
            ...taskTemplates.learning,
        ];

        for (let j = 0; j < numTasks; j++) {
            const taskStatuses = ['scheduled', 'in_progress', 'completed', 'deferred', 'waiting'];
            const status = faker.helpers.arrayElement(taskStatuses);
            const hasSubtasks = faker.helpers.maybe(() => true, { probability: 0.3 });
            const taskName = faker.helpers.arrayElement(allTaskTemplates);

            const task = {
                name: taskName,
                description: null,
                status,
                priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
                dueInDays: faker.helpers.maybe(() => faker.number.int({ min: -3, max: 15 }), { probability: 0.5 }),
                deferInDays: status === 'deferred' ? faker.number.int({ min: 1, max: 10 }) : null,
                today: faker.datatype.boolean(0.2),
                tags: faker.helpers.arrayElements(selectedTags.map((n) => slugify(n, { lower: true, strict: true })), faker.number.int({ min: 0, max: 3 })),
                note: null,
                completedAgoDays: status === 'completed' ? faker.number.int({ min: 1, max: 30 }) : null,
                createdAgoDays: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 60 }), { probability: 0.3 }),
            };

            if (hasSubtasks) {
                const numSubtasks = faker.number.int({ min: 2, max: 4 });
                task.subtasks = [];
                for (let k = 0; k < numSubtasks; k++) {
                    task.subtasks.push({
                        name: faker.helpers.arrayElement(allTaskTemplates),
                        status: faker.helpers.arrayElement(taskStatuses),
                        priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
                        tags: faker.helpers.arrayElements(selectedTags.map((n) => slugify(n, { lower: true, strict: true })), faker.number.int({ min: 0, max: 2 })),
                    });
                }
            }

            project.tasks.push(task);
        }

        projects.push(project);
    }

    // Generate standalone tasks
    const numStandaloneTasks = faker.number.int({ min: 5, max: 10 });
    const standaloneTasks = [];
    const allTaskTemplates = [
        ...taskTemplates.work,
        ...taskTemplates.personal,
        ...taskTemplates.health,
        ...taskTemplates.learning,
    ];

    for (let i = 0; i < numStandaloneTasks; i++) {
        const taskStatuses = ['scheduled', 'in_progress', 'completed', 'deferred', 'waiting'];
        const status = faker.helpers.arrayElement(taskStatuses);

        standaloneTasks.push({
            name: faker.helpers.arrayElement(allTaskTemplates),
            description: null,
            status,
            priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
            dueInDays: faker.helpers.maybe(() => faker.number.int({ min: -2, max: 20 }), { probability: 0.5 }),
            today: faker.datatype.boolean(0.15),
            tags: faker.helpers.arrayElements(selectedTags.map((n) => slugify(n, { lower: true, strict: true })), faker.number.int({ min: 0, max: 3 })),
            completedAgoDays: status === 'completed' ? faker.number.int({ min: 1, max: 45 }) : null,
            createdAgoDays: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 90 }), { probability: 0.3 }),
        });
    }

    // Generate notes
    const numNotes = faker.number.int({ min: 3, max: 6 });
    const notes = [];
    const selectedNotes = faker.helpers.arrayElements(noteTemplates, numNotes);

    for (let i = 0; i < numNotes; i++) {
        const noteTemplate = selectedNotes[i];
        notes.push({
            title: noteTemplate.title,
            content: noteTemplate.content,
            project: faker.helpers.maybe(() => faker.helpers.arrayElement(projects).slug, { probability: 0.6 }),
            tags: faker.helpers.arrayElements(selectedTags.map((n) => slugify(n, { lower: true, strict: true })), faker.number.int({ min: 0, max: 3 })),
        });
    }

    // Generate inbox items
    const numInboxItems = faker.number.int({ min: 4, max: 8 });
    const inboxItems = [];
    const inboxStatuses = ['added', 'triaged', 'processed'];
    const suggestedTypes = ['task', 'project', 'note', null];
    const selectedInboxItems = faker.helpers.arrayElements(inboxTemplates, numInboxItems);

    for (let i = 0; i < numInboxItems; i++) {
        const inboxTemplate = selectedInboxItems[i];
        const suggestedType = faker.helpers.arrayElement(suggestedTypes);
        const projectSlugs = projects.map((p) => p.slug);

        inboxItems.push({
            title: null,
            content: inboxTemplate.content,
            source: inboxTemplate.source,
            status: faker.helpers.arrayElement(inboxStatuses),
            suggested_type: suggestedType,
            suggested_reason: null,
            parsed_tags: faker.helpers.maybe(() => faker.helpers.arrayElements(selectedTags.map((n) => slugify(n, { lower: true, strict: true })), faker.number.int({ min: 1, max: 3 })), { probability: 0.7 }),
            parsed_projects: faker.helpers.maybe(() => faker.helpers.arrayElements(projectSlugs, faker.number.int({ min: 1, max: 2 })), { probability: 0.5 }),
        });
    }

    return {
        key: `user-${faker.string.alphanumeric(8)}`,
        profile: {
            name: firstName,
            surname: lastName,
            email,
            password: 'password123',
            timezone: faker.location.timeZone(),
            language: 'en',
            appearance: faker.helpers.arrayElement(['light', 'dark']),
            first_day_of_week: faker.helpers.arrayElement([0, 1]),
            is_admin: false,
        },
        areas,
        tags,
        projects,
        standaloneTasks,
        notes,
        inboxItems,
    };
};

const seedBlueprint = async (blueprint) => {
    const user = await upsertUser(blueprint.profile);
    await cleanupUserData(user.id);

    const areaMap = await createAreas(user.id, blueprint.areas);
    const tagMap = await createTags(user.id, blueprint.tags);
    const projectMap = await createProjects(
        user.id,
        blueprint.projects,
        areaMap
    );

    const stats = {
        areas: areaMap.size,
        tags: tagMap.size,
        projects: projectMap.size,
        tasks: 0,
        notes: 0,
        inbox: 0,
    };

    for (const projectDef of blueprint.projects) {
        if (!Array.isArray(projectDef.tasks) || projectDef.tasks.length === 0) {
            continue;
        }

        await createTasks(projectDef.tasks, {
            userId: user.id,
            tagMap,
            projectMap,
            stats,
            defaultProjectSlug: projectDef.slug,
        });
    }

    if (Array.isArray(blueprint.standaloneTasks)) {
        await createTasks(blueprint.standaloneTasks, {
            userId: user.id,
            tagMap,
            projectMap,
            stats,
        });
    }

    await createNotes(blueprint.notes, {
        userId: user.id,
        tagMap,
        projectMap,
        stats,
    });

    await createInboxItems(blueprint.inboxItems, user.id, stats, projectMap, tagMap);

    return {
        email: user.email,
        ...stats,
    };
};

async function seedDatabase() {
    try {
        console.log('🌱 Running unified TuDuDi demo seeder with faker...\n');
        const summaries = [];

        // First, create a consistent test admin user
        const testAdminBlueprint = generateRandomBlueprint();
        testAdminBlueprint.profile.name = 'Test';
        testAdminBlueprint.profile.surname = 'User';
        testAdminBlueprint.profile.email = 'test@tududi.com';
        testAdminBlueprint.profile.is_admin = true;

        const testSummary = await seedBlueprint(testAdminBlueprint);
        summaries.push(testSummary);
        console.log(
            `✅ ${testSummary.email} (admin): ${testSummary.tasks} tasks, ${testSummary.projects} projects, ${testSummary.areas} areas`
        );

        // Generate 2-3 additional random users
        const numAdditionalUsers = faker.number.int({ min: 2, max: 3 });
        for (let i = 0; i < numAdditionalUsers; i++) {
            const blueprint = generateRandomBlueprint();
            const summary = await seedBlueprint(blueprint);
            summaries.push(summary);

            console.log(
                `✅ ${summary.email}: ${summary.tasks} tasks, ${summary.projects} projects, ${summary.areas} areas`
            );
        }

        console.log('\n✨ Seeder finished with the following coverage:');
        summaries.forEach((summary) => {
            console.log(
                `   • ${summary.email} → ${summary.tasks} tasks, ${summary.notes} notes, ${summary.inbox} inbox items`
            );
        });

        console.log('\n🎲 Random data generated with faker!');
        console.log(
            'You can now log in with test@tududi.com / password123 to explore the workspace.'
        );

        return summaries;
    } catch (error) {
        console.error('❌ Unified seeder failed:', error);
        throw error;
    }
}

module.exports = { seedDatabase };

if (require.main === module) {
    seedDatabase()
        .then(() => {
            process.exit(0);
        })
        .catch(() => {
            process.exit(1);
        });
}
