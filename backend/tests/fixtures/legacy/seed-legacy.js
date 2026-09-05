#!/usr/bin/env node

// Seeds a deterministic, realistic dataset into a tududi database using the
// models of WHATEVER checkout this script is run from (cwd must be that
// checkout's backend/ directory). It is used by build.sh to produce the legacy
// SQLite fixtures under tests/fixtures/legacy, so it must keep working against
// older model definitions: every row is filtered through Model.rawAttributes
// and models that do not exist yet are skipped.
//
// Usage (server stopped, DB already bootstrapped by that version's start.sh):
//   NODE_ENV=production DB_FILE=/abs/path.sqlite3 node seed-legacy.js
//
// Env:
//   LEGACY_COLLISION=1   also create two users whose emails differ only by case
//   SEED_BASE_DATE       ISO date used as "now" (default 2026-08-01T09:00:00Z)

const path = require('path');

const models = require(path.join(process.cwd(), 'models'));
const { sequelize } = models;

const BASE = new Date(process.env.SEED_BASE_DATE || '2026-08-01T09:00:00Z');
const ADMIN_EMAIL = 'alice.legacy@example.com';
const ADMIN_EMAIL_MIXED = 'Alice.Legacy@Example.COM';
const BOB_EMAIL = 'bob@example.com';
const PASSWORD = 'password123';

function days(n) {
    return new Date(BASE.getTime() + n * 24 * 60 * 60 * 1000);
}

function model(name) {
    return models[name] && models[name].rawAttributes ? models[name] : null;
}

function pick(Model, row) {
    const attrs = Model.rawAttributes;
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (attrs[key]) out[key] = value;
    }
    return out;
}

async function create(Model, row, options) {
    return Model.create(pick(Model, row), options);
}

async function seedUsers() {
    const User = model('User');
    const Role = model('Role');

    let alice = await User.findOne({ where: { email: ADMIN_EMAIL } });
    if (!alice) {
        alice = await create(User, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            email_verified: true,
        });
        if (Role) {
            await create(Role, { user_id: alice.id, is_admin: true });
        }
    }
    await alice.update(
        pick(User, {
            name: 'Alice',
            surname: 'Legacy',
            timezone: 'Europe/Athens',
            language: 'en',
            email_verified: true,
        })
    );

    const bob = await create(User, {
        email: BOB_EMAIL,
        password: PASSWORD,
        name: 'Bob',
        timezone: 'UTC',
        email_verified: true,
    });

    if (process.env.LEGACY_COLLISION === '1') {
        await create(User, {
            email: 'carol@example.com',
            password: PASSWORD,
            name: 'Carol',
            email_verified: true,
        });
        await create(User, {
            email: 'carol2@example.com',
            password: PASSWORD,
            name: 'Carol Two',
            email_verified: true,
        });
    }

    return { alice, bob };
}

async function seedAreasGoals(alice) {
    const Area = model('Area');
    const Goal = model('Goal');

    const areas = [];
    for (const [name, color] of [
        ['Work', '#3b82f6'],
        ['Home', '#10b981'],
        ['Empty area', null],
    ]) {
        areas.push(
            await create(Area, {
                name,
                description: `${name} area`,
                color,
                user_id: alice.id,
            })
        );
    }

    const goals = [];
    if (Goal) {
        goals.push(
            await create(Goal, {
                title: 'Ship the release',
                why: 'Because users are waiting',
                horizon: 'season',
                status: 'active',
                area_id: areas[0].id,
                user_id: alice.id,
                target_date: '2026-12-31',
            })
        );
        goals.push(
            await create(Goal, {
                title: 'Run a marathon',
                horizon: 'year',
                status: 'paused',
                area_id: areas[1].id,
                user_id: alice.id,
            })
        );
    }

    return { areas, goals };
}

async function seedProjects(alice, areas, goals) {
    const Project = model('Project');
    const statusAttr = Project.rawAttributes.status;
    const statuses =
        statusAttr && statusAttr.type && statusAttr.type.values
            ? statusAttr.type.values
            : ['not_started', 'in_progress', 'done'];

    const projects = [];
    let i = 0;
    for (const status of statuses) {
        projects.push(
            await create(Project, {
                name: `Project ${status}`,
                description: `A project in status ${status}`,
                status,
                priority: i % 3,
                due_date_at: days(7 + i),
                area_id: areas[i % 2].id,
                goal_id: goals[0] ? goals[0].id : null,
                user_id: alice.id,
                pin_to_sidebar: i === 0,
            })
        );
        i++;
    }
    projects.push(
        await create(Project, {
            name: 'Orphan project',
            description: 'No area, no due date, no priority',
            status: statuses[0],
            area_id: null,
            due_date_at: null,
            priority: null,
            user_id: alice.id,
        })
    );
    return projects;
}

async function seedTags(alice) {
    const Tag = model('Tag');
    const hasType = !!Tag.rawAttributes.tag_type;
    const tags = {};

    for (const [name, color] of [
        ['urgent', '#ef4444'],
        ['reading', '#8b5cf6'],
        ['errand', null],
    ]) {
        tags[name] = await create(Tag, {
            name,
            color,
            user_id: alice.id,
            tag_type: 'user',
        });
    }

    for (const name of ['today', 'someday']) {
        let tag = await Tag.findOne({
            where: { name, user_id: alice.id },
        });
        if (!tag) {
            tag = await create(Tag, {
                name,
                user_id: alice.id,
                tag_type: hasType ? 'system' : undefined,
                pinned: true,
            });
        } else if (Tag.rawAttributes.pinned) {
            // Give the unpin-system-tags migration something to change.
            await tag.update({ pinned: true });
        }
        tags[name] = tag;
    }
    return tags;
}

async function seedTasks(alice, bob, projects, tags, areas, goals) {
    const Task = model('Task');
    const tasks = [];

    // One task per status value, priorities cycling, some without due dates.
    for (let status = 0; status <= 6; status++) {
        const task = await create(Task, {
            name: `Status ${status} task`,
            note: status % 2 === 0 ? `Note for status ${status}` : null,
            status,
            priority: status === 3 ? null : status % 3,
            due_date: status % 2 === 0 ? days(status) : null,
            defer_until: status === 5 ? days(3) : null,
            completed_at: status === 2 ? days(-1) : null,
            project_id: projects[status % projects.length].id,
            area_id: status === 6 ? areas[0].id : null,
            goal_id: goals[0] && status === 1 ? goals[0].id : null,
            user_id: alice.id,
            order: status,
        });
        tasks.push(task);
    }

    // Overdue and far-future tasks for the Today/Upcoming views.
    tasks.push(
        await create(Task, {
            name: 'Overdue task',
            status: 0,
            priority: 2,
            due_date: days(-10),
            user_id: alice.id,
        })
    );
    tasks.push(
        await create(Task, {
            name: 'Far future task',
            status: 0,
            priority: 0,
            due_date: days(60),
            user_id: alice.id,
        })
    );

    // Recurring parent with two generated instances.
    const recurring = await create(Task, {
        name: 'Weekly review',
        status: 0,
        priority: 1,
        due_date: days(2),
        recurrence_type: 'weekly',
        recurrence_interval: 1,
        recurrence_weekday: 1,
        completion_based: false,
        project_id: projects[0].id,
        user_id: alice.id,
    });
    tasks.push(recurring);
    for (const offset of [-7, 0]) {
        tasks.push(
            await create(Task, {
                name: 'Weekly review',
                status: offset < 0 ? 2 : 0,
                priority: 1,
                due_date: days(2 + offset),
                completed_at: offset < 0 ? days(2 + offset) : null,
                recurring_parent_id: recurring.id,
                project_id: projects[0].id,
                user_id: alice.id,
            })
        );
    }

    // Parent with three subtasks.
    const parent = await create(Task, {
        name: 'Parent with subtasks',
        status: 1,
        priority: 1,
        due_date: days(5),
        project_id: projects[1].id,
        user_id: alice.id,
    });
    tasks.push(parent);
    for (let n = 1; n <= 3; n++) {
        tasks.push(
            await create(Task, {
                name: `Subtask ${n}`,
                status: n === 3 ? 2 : 0,
                priority: 0,
                parent_task_id: parent.id,
                user_id: alice.id,
                order: n,
            })
        );
    }

    // A habit if the columns exist.
    if (Task.rawAttributes.habit_mode) {
        tasks.push(
            await create(Task, {
                name: 'Drink water',
                status: 0,
                priority: 0,
                habit_mode: true,
                habit_target_count: 1,
                habit_frequency_period: 'day',
                recurrence_type: 'daily',
                user_id: alice.id,
            })
        );
    }

    // Bob has a task of his own.
    tasks.push(
        await create(Task, {
            name: 'Bob task',
            status: 0,
            priority: 1,
            due_date: days(1),
            user_id: bob.id,
        })
    );

    // Tag links.
    if (typeof tasks[0].setTags === 'function') {
        await tasks[0].setTags([tags.urgent, tags.today]);
        await tasks[1].setTags([tags.reading]);
        await tasks[4].setTags([tags.someday]);
        await recurring.setTags([tags.urgent]);
    }

    return { tasks, recurring, parent };
}

async function seedTaskExtras(alice, tasks, recurring) {
    const TaskEvent = model('TaskEvent');
    const RecurringCompletion = model('RecurringCompletion');
    const TaskAttachment = model('TaskAttachment');

    if (TaskEvent) {
        await create(TaskEvent, {
            task_id: tasks[0].id,
            user_id: alice.id,
            event_type: 'created',
            field_name: null,
            old_value: null,
            new_value: JSON.stringify({ name: tasks[0].name }),
            metadata: JSON.stringify({ source: 'seed' }),
        });
        await create(TaskEvent, {
            task_id: tasks[2].id,
            user_id: alice.id,
            event_type: 'status_changed',
            field_name: 'status',
            old_value: JSON.stringify(0),
            new_value: JSON.stringify(2),
        });
    }

    if (RecurringCompletion) {
        await create(RecurringCompletion, {
            task_id: recurring.id,
            completed_at: days(-5),
            original_due_date: days(-5),
            skipped: false,
        });
    }

    if (TaskAttachment) {
        await create(TaskAttachment, {
            task_id: tasks[0].id,
            user_id: alice.id,
            original_filename: 'spec.pdf',
            stored_filename: 'seed-spec.pdf',
            file_size: 1234,
            mime_type: 'application/pdf',
            file_path: 'uploads/tasks/seed-spec.pdf',
        });
    }
}

async function seedNotesInbox(alice, projects, tags) {
    const Note = model('Note');
    const InboxItem = model('InboxItem');

    const note = await create(Note, {
        title: 'Release checklist',
        content: '# Checklist\n\n- [ ] run tests\n- [ ] tag release',
        project_id: projects[0].id,
        user_id: alice.id,
        color: '#fde68a',
    });
    await create(Note, {
        title: 'Loose note',
        content: 'Not attached to a project',
        project_id: null,
        user_id: alice.id,
    });
    if (typeof note.setTags === 'function') {
        await note.setTags([tags.reading]);
    }

    if (InboxItem) {
        await create(InboxItem, {
            content: 'Buy milk #errand',
            status: 'added',
            source: 'web',
            user_id: alice.id,
        });
        await create(InboxItem, {
            content: 'Idea: write a blog post',
            status: 'added',
            source: 'telegram',
            user_id: alice.id,
        });
    }
}

async function seedPeople(alice, tasks) {
    const Person = model('Person');
    if (!Person) return;

    const dana = await create(Person, {
        name: 'Dana Contact',
        email: 'dana@example.com',
        relationship_type: 'colleague',
        user_id: alice.id,
        archived: false,
    });
    await create(Person, {
        name: 'Archived Friend',
        relationship_type: 'friend',
        user_id: alice.id,
        archived: true,
    });

    const Task = model('Task');
    if (Task.rawAttributes.involves) {
        await tasks[1].update({ involves: JSON.stringify([dana.uid]) });
    }
}

async function seedSharing(alice, bob, projects) {
    const Permission = model('Permission');
    const View = model('View');
    const ApiToken = model('ApiToken');
    const Notification = model('Notification');
    const CalendarToken = model('CalendarToken');

    if (Permission) {
        await create(Permission, {
            user_id: bob.id,
            resource_type: 'project',
            resource_uid: projects[0].uid,
            access_level: 'ro',
            propagation: 'inherit',
            granted_by_user_id: alice.id,
        });
    }

    if (View) {
        await create(View, {
            name: 'Urgent work',
            user_id: alice.id,
            search_query: 'urgent',
            filters: JSON.stringify({ type: 'tasks' }),
            tags: JSON.stringify(['urgent']),
            extras: JSON.stringify({}),
            is_pinned: true,
        });
    }

    if (ApiToken) {
        await create(ApiToken, {
            user_id: alice.id,
            name: 'seed token',
            token_hash: 'a'.repeat(64),
            token_prefix: 'tt_seed',
            abilities: ['read'],
        });
    }

    if (Notification) {
        await create(Notification, {
            user_id: alice.id,
            type: 'task_due_soon',
            level: 'info',
            title: 'Task due soon',
            message: 'Status 0 task is due',
            data: { task: 'seed' },
            sources: ['email'],
        });
        await create(Notification, {
            user_id: alice.id,
            type: 'project_due_soon',
            level: 'warning',
            title: 'Project due',
            read_at: days(-1),
            sources: ['email'],
        });
    }

    if (CalendarToken) {
        await create(CalendarToken, {
            user_id: alice.id,
            provider: 'google',
            access_token: 'seed-access-token',
            refresh_token: 'seed-refresh-token',
            token_type: 'Bearer',
            expires_at: days(30),
            scope: 'calendar.readonly',
            connected_email: ADMIN_EMAIL,
        });
    }
}

async function seedCalDav(alice, tasks, recurring) {
    const CalDAVCalendar = model('CalDAVCalendar');
    const CalDAVSyncState = model('CalDAVSyncState');
    const CalDAVOccurrenceOverride = model('CalDAVOccurrenceOverride');
    if (!CalDAVCalendar) return;

    const calendar = await create(CalDAVCalendar, {
        user_id: alice.id,
        name: 'Seed calendar',
        description: 'CalDAV calendar from the seeder',
        color: '#0ea5e9',
        enabled: true,
        sync_direction: 'bidirectional',
        sync_interval_minutes: 15,
        conflict_resolution: 'local_wins',
    });

    if (CalDAVSyncState) {
        await create(CalDAVSyncState, {
            task_id: tasks[0].id,
            calendar_id: calendar.id,
            etag: 'seed-etag-1',
            remote_href: '/caldav/seed/1.ics',
            last_modified: days(-1),
            last_synced_at: days(-1),
            sync_status: 'synced',
        });
    }

    if (CalDAVOccurrenceOverride) {
        await create(CalDAVOccurrenceOverride, {
            parent_task_id: recurring.id,
            calendar_id: calendar.id,
            recurrence_id: days(9),
            override_name: 'Weekly review (moved)',
            override_due_date: days(10),
        });
    }
}

async function applyLegacyQuirks() {
    // Hooks lowercase emails on write, so the mixed-case email that pre-2026
    // accounts carry has to be planted with raw SQL.
    await sequelize.query(
        'UPDATE users SET email = :mixed WHERE email = :lower',
        { replacements: { mixed: ADMIN_EMAIL_MIXED, lower: ADMIN_EMAIL } }
    );
    if (process.env.LEGACY_COLLISION === '1') {
        await sequelize.query(
            "UPDATE users SET email = 'Carol@Example.com' WHERE email = 'carol2@example.com'"
        );
    }
    // Make a few rows look old.
    await sequelize.query(
        "UPDATE tasks SET created_at = '2025-11-02 10:00:00.000 +00:00', updated_at = '2025-11-02 10:00:00.000 +00:00' WHERE name = 'Overdue task'"
    );
}

async function rowCounts() {
    const [tables] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const counts = {};
    for (const { name } of tables) {
        const [[row]] = await sequelize.query(
            `SELECT COUNT(*) AS n FROM "${name}"`
        );
        counts[name] = Number(row.n);
    }
    return counts;
}

async function main() {
    await sequelize.authenticate();

    const { alice, bob } = await seedUsers();
    const { areas, goals } = await seedAreasGoals(alice);
    const projects = await seedProjects(alice, areas, goals);
    const tags = await seedTags(alice);
    const { tasks, recurring } = await seedTasks(
        alice,
        bob,
        projects,
        tags,
        areas,
        goals
    );
    await seedTaskExtras(alice, tasks, recurring);
    await seedNotesInbox(alice, projects, tags);
    await seedPeople(alice, tasks);
    await seedSharing(alice, bob, projects);
    await seedCalDav(alice, tasks, recurring);
    await applyLegacyQuirks();

    const counts = await rowCounts();
    process.stdout.write(JSON.stringify(counts) + '\n');
    await sequelize.close();
}

main().catch(async (error) => {
    console.error('Seeding failed:', error);
    try {
        await sequelize.close();
    } catch (_) {
        // ignore
    }
    process.exit(1);
});
