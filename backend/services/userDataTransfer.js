'use strict';

// Export and import of one user's data (format 2).
//
// Format 2 references related records by uid (area_uid, project_uid,
// parent_task_uid, ...), embeds attachment files as base64, and carries
// goals and people. Numeric ids from the source database are still present
// for information but are never used to link records on import, so a
// backup taken on one instance restores cleanly on another and can never
// point at rows belonging to a different user.
//
// Format 1 backups (no uid references) still import; their numeric
// references are resolved only among the importing user's own rows.

const path = require('path');
const fs = require('fs').promises;
const {
    User,
    Area,
    Goal,
    Project,
    Task,
    Tag,
    Note,
    InboxItem,
    TaskEvent,
    View,
    Person,
    RecurringCompletion,
    TaskAttachment,
    sequelize,
} = require('../models');
const { getConfig } = require('../config/config');
const { uid: generateUid } = require('../utils/uid');
const packageJson = require('../../package.json');

const FORMAT = 2;

const plain = (row) => (row && row.toJSON ? row.toJSON() : row);

async function readAttachmentData(attachment) {
    try {
        const filePath = path.join(
            getConfig().uploadPath,
            attachment.file_path
        );
        const buffer = await fs.readFile(filePath);
        return buffer.toString('base64');
    } catch (_) {
        return null;
    }
}

async function exportUserData(userId) {
    const user = await User.findByPk(userId, {
        attributes: {
            exclude: [
                'id',
                'password_digest',
                'email_verification_token',
                'email_verification_token_expires_at',
                'password_reset_token_hash',
                'password_reset_token_expires_at',
            ],
        },
    });
    if (!user) throw new Error('User not found');

    const [
        areas,
        goals,
        projects,
        tasks,
        tags,
        notes,
        inboxItems,
        taskEvents,
        views,
        people,
    ] = await Promise.all([
        Area.findAll({ where: { user_id: userId } }),
        Goal.findAll({ where: { user_id: userId } }),
        Project.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Tag,
                    through: { attributes: [] },
                    attributes: ['uid', 'name'],
                },
            ],
        }),
        Task.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Tag,
                    through: { attributes: [] },
                    attributes: ['uid', 'name'],
                },
                { model: RecurringCompletion, as: 'Completions' },
                { model: TaskAttachment, as: 'Attachments' },
            ],
        }),
        Tag.findAll({ where: { user_id: userId } }),
        Note.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Tag,
                    through: { attributes: [] },
                    attributes: ['uid', 'name'],
                },
            ],
        }),
        InboxItem.findAll({ where: { user_id: userId } }),
        TaskEvent.findAll({ where: { user_id: userId } }),
        View.findAll({ where: { user_id: userId } }),
        Person.findAll({ where: { user_id: userId } }),
    ]);

    const uidById = (rows) =>
        Object.fromEntries(rows.map((r) => [r.id, r.uid]));
    const areaUid = uidById(areas);
    const goalUid = uidById(goals);
    const projectUid = uidById(projects);
    const taskUid = uidById(tasks);

    const exportedTasks = [];
    for (const task of tasks) {
        const data = plain(task);
        data.tag_uids = (task.Tags || []).map((t) => t.uid);
        data.project_uid = projectUid[data.project_id] || null;
        data.area_uid = areaUid[data.area_id] || null;
        data.goal_uid = goalUid[data.goal_id] || null;
        data.parent_task_uid = taskUid[data.parent_task_id] || null;
        data.recurring_parent_uid = taskUid[data.recurring_parent_id] || null;
        data.completions = (data.Completions || []).map((c) => ({
            completed_at: c.completed_at,
            original_due_date: c.original_due_date,
            skipped: c.skipped,
        }));
        data.attachments = [];
        for (const attachment of task.Attachments || []) {
            const a = plain(attachment);
            data.attachments.push({
                uid: a.uid,
                original_filename: a.original_filename,
                file_size: a.file_size,
                mime_type: a.mime_type,
                data: await readAttachmentData(a),
            });
        }
        delete data.Tags;
        delete data.Completions;
        delete data.Attachments;
        exportedTasks.push(data);
    }

    return {
        version: packageJson.version,
        format: FORMAT,
        exported_at: new Date().toISOString(),
        user: {
            uid: user.uid,
            email: user.email,
            name: user.name,
            surname: user.surname,
            appearance: user.appearance,
            language: user.language,
            timezone: user.timezone,
            first_day_of_week: user.first_day_of_week,
            avatar_image: user.avatar_image,
            telegram_bot_token: user.telegram_bot_token,
            telegram_chat_id: user.telegram_chat_id,
            telegram_allowed_users: user.telegram_allowed_users,
            task_summary_enabled: user.task_summary_enabled,
            task_summary_frequency: user.task_summary_frequency,
            features: user.features,
            today_settings: user.today_settings,
            sidebar_settings: user.sidebar_settings,
            ui_settings: user.ui_settings,
            notification_preferences: user.notification_preferences,
            ai_profile: user.ai_profile,
        },
        data: {
            areas: areas.map(plain),
            goals: goals.map((g) => ({
                ...plain(g),
                area_uid: areaUid[g.area_id] || null,
            })),
            projects: projects.map((p) => {
                const data = plain(p);
                data.tag_uids = (p.Tags || []).map((t) => t.uid);
                data.area_uid = areaUid[data.area_id] || null;
                data.goal_uid = goalUid[data.goal_id] || null;
                delete data.Tags;
                return data;
            }),
            tasks: exportedTasks,
            tags: tags.map(plain),
            notes: notes.map((n) => {
                const data = plain(n);
                data.tag_uids = (n.Tags || []).map((t) => t.uid);
                data.project_uid = projectUid[data.project_id] || null;
                delete data.Tags;
                return data;
            }),
            inbox_items: inboxItems.map(plain),
            task_events: taskEvents.map(plain),
            views: views.map(plain),
            people: people.map((person) => ({
                ...plain(person),
                // true for the card that represents the exporting user
                is_self: person.linked_user_id === userId,
                linked_user_id: undefined,
            })),
        },
    };
}

// Resolves a reference either by uid (format 2) or, for old backups, by the
// source's numeric id, but only among the importing user's own rows.
function makeResolver(userId, transaction) {
    return async (Model, uid, legacyId, uidMap) => {
        if (uid && uidMap[uid]) return uidMap[uid];
        if (uid) {
            const row = await Model.findOne({
                where: { uid, user_id: userId },
                attributes: ['id'],
                transaction,
            });
            if (row) return row.id;
        }
        if (legacyId && !uid) {
            const row = await Model.findOne({
                where: { id: legacyId, user_id: userId },
                attributes: ['id'],
                transaction,
            });
            if (row) return row.id;
        }
        return null;
    };
}

async function writeAttachmentFile(attachment) {
    if (!attachment.data) return null;
    const buffer = Buffer.from(attachment.data, 'base64');
    const ext = path.extname(attachment.original_filename || '') || '';
    const storedFilename = `${generateUid()}${ext}`;
    const dir = path.join(getConfig().uploadPath, 'tasks');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, storedFilename), buffer);
    return { storedFilename, size: buffer.length };
}

async function importUserData(userId, backupData, options = { merge: true }) {
    if (!backupData || !backupData.version || !backupData.data) {
        throw new Error('Invalid backup data format');
    }
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const merge = options.merge !== false;
    const d = backupData.data;
    const stats = {};
    const count = (key, field) => {
        stats[key] = stats[key] || { created: 0, skipped: 0 };
        stats[key][field] += 1;
    };
    const uidMaps = {
        areas: {},
        goals: {},
        projects: {},
        tasks: {},
        tags: {},
        people: {},
    };
    const writtenFiles = [];
    const transaction = await sequelize.transaction();
    const resolve = makeResolver(userId, transaction);

    // uids are unique across the whole table, not per user. A row with the
    // backup's uid that belongs to this user is the same record (skip); one
    // that belongs to someone else means the backup came from another
    // account on this instance, so the imported row gets a fresh uid. The
    // uid maps are keyed by the backup's uid either way, so references
    // resolve.
    const upsertByUid = async (Model, key, uid, build) => {
        uidMaps[key] = uidMaps[key] || {};
        const existing = await Model.findOne({ where: { uid }, transaction });
        if (existing && existing.user_id === userId) {
            count(key, 'skipped');
            uidMaps[key][uid] = existing.id;
            return { row: existing, created: false };
        }
        if (!merge) {
            count(key, 'skipped');
            return { row: null, created: false };
        }
        const row = await Model.create(
            {
                ...(await build()),
                uid: existing ? generateUid() : uid,
                user_id: userId,
            },
            { transaction }
        );
        count(key, 'created');
        uidMaps[key][uid] = row.id;
        return { row, created: true };
    };

    try {
        // Tags are unique per user by name, and every user is seeded with
        // the same system tags, so a tag matches by name as well as by uid.
        for (const tag of d.tags || []) {
            const byName = await Tag.findOne({
                where: { user_id: userId, name: tag.name },
                attributes: ['id'],
                transaction,
            });
            if (byName) {
                uidMaps.tags[tag.uid] = byName.id;
                count('tags', 'skipped');
                continue;
            }
            await upsertByUid(Tag, 'tags', tag.uid, async () => ({
                name: tag.name,
            }));
        }

        for (const area of d.areas || []) {
            await upsertByUid(Area, 'areas', area.uid, async () => ({
                name: area.name,
                description: area.description,
                color: area.color,
            }));
        }

        for (const goal of d.goals || []) {
            await upsertByUid(Goal, 'goals', goal.uid, async () => ({
                title: goal.title,
                why: goal.why,
                horizon: goal.horizon,
                target_date: goal.target_date,
                status: goal.status,
                color: goal.color,
                area_id: await resolve(
                    Area,
                    goal.area_uid,
                    goal.area_id,
                    uidMaps.areas
                ),
            }));
        }

        // People: the exporting user's own card maps onto this user's own
        // card instead of becoming a duplicate contact.
        const selfPerson = await Person.findOne({
            where: { user_id: userId, linked_user_id: userId },
            transaction,
        });
        for (const person of d.people || []) {
            if (person.is_self && selfPerson) {
                uidMaps.people[person.uid] = selfPerson.uid;
                count('people', 'skipped');
                continue;
            }
            const existing = await Person.findOne({
                where: { uid: person.uid },
                transaction,
            });
            if (existing && existing.user_id === userId) {
                uidMaps.people[person.uid] = existing.uid;
                count('people', 'skipped');
                continue;
            }
            if (!merge) {
                count('people', 'skipped');
                continue;
            }
            const nameTaken = await Person.findOne({
                where: { user_id: userId, name: person.name },
                attributes: ['id'],
                transaction,
            });
            const row = await Person.create(
                {
                    uid: existing ? generateUid() : person.uid,
                    user_id: userId,
                    name: nameTaken ? `${person.name} (imported)` : person.name,
                    relationship_type: person.relationship_type,
                    email: person.email,
                    phone: person.phone,
                    notes: person.notes,
                    archived: !!person.archived,
                    color: person.color,
                },
                { transaction }
            );
            uidMaps.people[person.uid] = row.uid;
            count('people', 'created');
        }
        const mapPerson = (personUid) =>
            personUid ? uidMaps.people[personUid] || null : null;

        for (const project of d.projects || []) {
            const { row, created } = await upsertByUid(
                Project,
                'projects',
                project.uid,
                async () => ({
                    name: project.name,
                    description: project.description,
                    pin_to_sidebar: project.pin_to_sidebar,
                    priority: project.priority,
                    due_date_at: project.due_date_at,
                    image_url: null,
                    color: project.color,
                    task_show_completed: project.task_show_completed,
                    task_sort_order: project.task_sort_order,
                    status: project.status || project.state,
                    is_maintenance: !!project.is_maintenance,
                    area_id: await resolve(
                        Area,
                        project.area_uid,
                        project.area_id,
                        uidMaps.areas
                    ),
                    goal_id: await resolve(
                        Goal,
                        project.goal_uid,
                        project.goal_id,
                        uidMaps.goals
                    ),
                })
            );
            if (created && project.tag_uids?.length) {
                const tagIds = project.tag_uids
                    .map((u) => uidMaps.tags[u])
                    .filter(Boolean);
                if (tagIds.length) await row.setTags(tagIds, { transaction });
            }
        }

        const createdTasks = new Map();
        for (const task of d.tasks || []) {
            const { row, created } = await upsertByUid(
                Task,
                'tasks',
                task.uid,
                async () => ({
                    name: task.name,
                    due_date: task.due_date,
                    defer_until: task.defer_until,
                    reminder_at: task.reminder_at,
                    priority: task.priority,
                    status: task.status,
                    note: task.note,
                    recurrence_type: task.recurrence_type,
                    recurrence_interval: task.recurrence_interval,
                    recurrence_end_date: task.recurrence_end_date,
                    recurrence_weekday: task.recurrence_weekday,
                    recurrence_weekdays: task.recurrence_weekdays,
                    recurrence_month_day: task.recurrence_month_day,
                    recurrence_week_of_month: task.recurrence_week_of_month,
                    completion_based: task.completion_based,
                    order: task.order,
                    completed_at: task.completed_at,
                    habit_mode: task.habit_mode,
                    habit_target_count: task.habit_target_count,
                    habit_frequency_period: task.habit_frequency_period,
                    habit_streak_mode: task.habit_streak_mode,
                    habit_flexibility_mode: task.habit_flexibility_mode,
                    habit_current_streak: task.habit_current_streak,
                    habit_best_streak: task.habit_best_streak,
                    habit_total_completions: task.habit_total_completions,
                    habit_last_completion_at: task.habit_last_completion_at,
                    assigned_to: mapPerson(task.assigned_to),
                    involves: Array.isArray(task.involves)
                        ? task.involves.map(mapPerson).filter(Boolean)
                        : task.involves,
                    project_id: await resolve(
                        Project,
                        task.project_uid,
                        task.project_id,
                        uidMaps.projects
                    ),
                    area_id: await resolve(
                        Area,
                        task.area_uid,
                        task.area_id,
                        uidMaps.areas
                    ),
                    goal_id: await resolve(
                        Goal,
                        task.goal_uid,
                        task.goal_id,
                        uidMaps.goals
                    ),
                })
            );
            if (!created) continue;
            createdTasks.set(task.uid, row);

            if (task.tag_uids?.length) {
                const tagIds = task.tag_uids
                    .map((u) => uidMaps.tags[u])
                    .filter(Boolean);
                if (tagIds.length) await row.setTags(tagIds, { transaction });
            }
            for (const completion of task.completions || []) {
                await RecurringCompletion.create(
                    {
                        task_id: row.id,
                        completed_at:
                            completion.completed_at ||
                            completion.completion_date,
                        original_due_date: completion.original_due_date || null,
                        skipped: !!completion.skipped,
                    },
                    { transaction }
                );
            }
            for (const attachment of task.attachments || []) {
                const file = await writeAttachmentFile(attachment);
                if (!file) continue;
                writtenFiles.push(file.storedFilename);
                await TaskAttachment.create(
                    {
                        uid: generateUid(),
                        task_id: row.id,
                        user_id: userId,
                        original_filename:
                            attachment.original_filename || file.storedFilename,
                        stored_filename: file.storedFilename,
                        file_size: file.size,
                        mime_type:
                            attachment.mime_type || 'application/octet-stream',
                        file_path: `tasks/${file.storedFilename}`,
                    },
                    { transaction }
                );
                count('attachments', 'created');
            }
        }

        // Second pass: parent and recurring links among the created tasks
        for (const task of d.tasks || []) {
            const row = createdTasks.get(task.uid);
            if (!row) continue;
            const updates = {};
            const parentId = await resolve(
                Task,
                task.parent_task_uid,
                task.parent_task_id,
                uidMaps.tasks
            );
            if (parentId) updates.parent_task_id = parentId;
            const recurringId = await resolve(
                Task,
                task.recurring_parent_uid,
                task.recurring_parent_id,
                uidMaps.tasks
            );
            if (recurringId) updates.recurring_parent_id = recurringId;
            if (Object.keys(updates).length)
                await row.update(updates, { transaction });
        }

        for (const note of d.notes || []) {
            const { row, created } = await upsertByUid(
                Note,
                'notes',
                note.uid,
                async () => ({
                    title: note.title,
                    content: note.content,
                    color: note.color,
                    project_id: await resolve(
                        Project,
                        note.project_uid,
                        note.project_id,
                        uidMaps.projects
                    ),
                })
            );
            if (created && note.tag_uids?.length) {
                const tagIds = note.tag_uids
                    .map((u) => uidMaps.tags[u])
                    .filter(Boolean);
                if (tagIds.length) await row.setTags(tagIds, { transaction });
            }
        }

        for (const item of d.inbox_items || []) {
            await upsertByUid(InboxItem, 'inbox_items', item.uid, async () => ({
                name: item.name,
                content: item.content,
                status: item.status,
            }));
        }

        for (const view of d.views || []) {
            await upsertByUid(View, 'views', view.uid, async () => ({
                name: view.name,
                search_query: view.search_query,
                filters: view.filters,
                priority: view.priority,
                due: view.due,
                defer: view.defer,
                tags: view.tags,
                extras: view.extras,
                recurring: view.recurring,
                is_pinned: view.is_pinned,
            }));
        }

        await transaction.commit();
        return stats;
    } catch (error) {
        await transaction.rollback();
        const dir = path.join(getConfig().uploadPath, 'tasks');
        for (const name of writtenFiles) {
            await fs.unlink(path.join(dir, name)).catch(() => {});
        }
        throw error;
    }
}

module.exports = { exportUserData, importUserData, FORMAT };
