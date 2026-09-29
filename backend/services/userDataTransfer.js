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
    InboxItemAttachment,
    ProjectAttachment,
    NoteAttachment,
    Role,
    Permission,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
    sequelize,
} = require('../models');
const { getConfig } = require('../config/config');
const { isAdmin } = require('./rolesService');
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

async function exportAttachments(attachments = []) {
    const exported = [];
    for (const attachment of attachments) {
        const a = plain(attachment);
        exported.push({
            uid: a.uid,
            stored_filename: a.stored_filename,
            original_filename: a.original_filename,
            file_size: a.file_size,
            mime_type: a.mime_type,
            data: await readAttachmentData(a),
        });
    }
    return exported;
}

// Project cover images and user avatars are stored as files on disk and
// referenced by URL (unlike task attachments, whose backup already embeds
// the file). Without embedding the bytes here too, the URL in the backup
// points at a file that no longer exists after a fresh install, so the
// picture silently disappears on restore.
async function readUploadedImage(url, subdir) {
    if (!url) return null;
    try {
        const filename = path.basename(url.split('?')[0]);
        const filePath = path.join(getConfig().uploadPath, subdir, filename);
        const buffer = await fs.readFile(filePath);
        return { filename, data: buffer.toString('base64') };
    } catch (_) {
        return null;
    }
}

async function writeUploadedImage(image, subdir, prefix) {
    if (!image || !image.data) return null;
    const ext = path.extname(image.filename || '') || '';
    const storedFilename = `${prefix}-${generateUid()}${ext}`;
    const dir = path.join(getConfig().uploadPath, subdir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
        path.join(dir, storedFilename),
        Buffer.from(image.data, 'base64')
    );
    return storedFilename;
}

async function exportOwnData(userId) {
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
                { model: ProjectAttachment, as: 'Attachments' },
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
                { model: NoteAttachment, as: 'Attachments' },
            ],
        }),
        InboxItem.findAll({
            where: { user_id: userId },
            include: [{ model: InboxItemAttachment, as: 'Attachments' }],
        }),
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

    const exportedProjects = [];
    for (const project of projects) {
        const data = plain(project);
        data.tag_uids = (project.Tags || []).map((t) => t.uid);
        data.area_uid = areaUid[data.area_id] || null;
        data.goal_uid = goalUid[data.goal_id] || null;
        data.cover_image = await readUploadedImage(
            project.image_url,
            'projects'
        );
        data.attachments = await exportAttachments(project.Attachments);
        delete data.Tags;
        delete data.Attachments;
        exportedProjects.push(data);
    }

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
            value: c.value,
            note: c.note,
        }));
        data.attachments = await exportAttachments(task.Attachments);
        delete data.Tags;
        delete data.Completions;
        delete data.Attachments;
        exportedTasks.push(data);
    }

    const exportedNotes = [];
    for (const note of notes) {
        const data = plain(note);
        data.tag_uids = (note.Tags || []).map((t) => t.uid);
        data.project_uid = projectUid[data.project_id] || null;
        data.attachments = await exportAttachments(note.Attachments);
        delete data.Tags;
        delete data.Attachments;
        exportedNotes.push(data);
    }

    // A card can stand for another account (a member). Its uid lets an
    // instance restore link the card again.
    const linkedIds = [
        ...new Set(
            people
                .map((p) => p.linked_user_id)
                .filter((id) => id && id !== userId)
        ),
    ];
    const linkedUsers = linkedIds.length
        ? await User.findAll({
              where: { id: linkedIds },
              attributes: ['id', 'uid'],
              raw: true,
          })
        : [];
    const userUidById = Object.fromEntries(
        linkedUsers.map((u) => [u.id, u.uid])
    );

    const exportedInboxItems = [];
    for (const item of inboxItems) {
        const data = plain(item);
        data.attachments = await exportAttachments(item.Attachments);
        delete data.Attachments;
        exportedInboxItems.push(data);
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
            keyboard_shortcuts: user.keyboard_shortcuts,
            avatar_image_data: await readUploadedImage(
                user.avatar_image,
                'avatars'
            ),
        },
        data: {
            areas: areas.map(plain),
            goals: goals.map((g) => ({
                ...plain(g),
                area_uid: areaUid[g.area_id] || null,
            })),
            projects: exportedProjects,
            tasks: exportedTasks,
            tags: tags.map(plain),
            notes: exportedNotes,
            inbox_items: exportedInboxItems,
            task_events: taskEvents.map(plain),
            views: views.map(plain),
            people: people.map((person) => ({
                ...plain(person),
                // true for the card that represents the exporting user
                is_self: person.linked_user_id === userId,
                linked_user_uid:
                    person.linked_user_id && person.linked_user_id !== userId
                        ? userUidById[person.linked_user_id] || null
                        : null,
                linked_user_id: undefined,
            })),
        },
    };
}

const isHosted = () => getConfig().hosted?.enabled === true;

const roleData = (role) =>
    role
        ? {
              is_admin: !!role.is_admin,
              role: role.role,
              capabilities: role.capabilities ?? null,
          }
        : null;

// An admin's backup of a self-hosted instance also carries every other
// account (with its password hash and its own data), the groups and the
// shares, so restoring it on a fresh install brings everyone back. Records
// point at each other by uid.
async function exportInstance(userId) {
    const [users, roles, groups, members, groupShares, groupPerms, shares] =
        await Promise.all([
            User.findAll({
                attributes: [
                    'id',
                    'uid',
                    'email',
                    'name',
                    'surname',
                    'password_digest',
                    'email_verified',
                    'created_by_user_id',
                ],
                raw: true,
            }),
            Role.findAll({ raw: true }),
            UserGroup.findAll({ raw: true }),
            UserGroupMember.findAll({ raw: true }),
            GroupShare.findAll({ raw: true }),
            GroupPermission.findAll({ raw: true }),
            Permission.findAll({ raw: true }),
        ]);

    const uidOf = Object.fromEntries(users.map((u) => [u.id, u.uid]));
    const roleOf = Object.fromEntries(roles.map((r) => [r.user_id, r]));

    const accounts = [];
    for (const u of users) {
        if (u.id === userId) continue;
        accounts.push({
            account: {
                uid: u.uid,
                email: u.email,
                name: u.name,
                surname: u.surname,
                password_digest: u.password_digest,
                email_verified: u.email_verified,
                created_by_uid: uidOf[u.created_by_user_id] || null,
                role: roleData(roleOf[u.id]),
            },
            backup: await exportOwnData(u.id),
        });
    }

    const groupUidOf = Object.fromEntries(groups.map((g) => [g.id, g.uid]));
    return {
        exporter_role: roleData(roleOf[userId]),
        accounts,
        groups: groups.map((g) => ({
            uid: g.uid,
            name: g.name,
            description: g.description,
            created_by_uid: uidOf[g.created_by_user_id] || null,
            member_uids: members
                .filter((m) => m.group_id === g.id)
                .map((m) => uidOf[m.user_id])
                .filter(Boolean),
        })),
        group_shares: groupShares.map((gs) => ({
            group_uid: groupUidOf[gs.group_id],
            resource_type: gs.resource_type,
            resource_uid: gs.resource_uid,
            access_level: gs.access_level,
            granted_by_uid: uidOf[gs.granted_by_user_id] || null,
            permissions: groupPerms
                .filter((gp) => gp.group_share_id === gs.id)
                .map((gp) => ({
                    user_uid: uidOf[gp.user_id],
                    access_level: gp.access_level,
                    propagation: gp.propagation,
                    status: gp.status,
                })),
        })),
        shares: shares.map((p) => ({
            user_uid: uidOf[p.user_id],
            resource_type: p.resource_type,
            resource_uid: p.resource_uid,
            access_level: p.access_level,
            propagation: p.propagation,
            granted_by_uid: uidOf[p.granted_by_user_id] || null,
            status: p.status,
        })),
    };
}

async function exportUserData(userId) {
    const backup = await exportOwnData(userId);
    if (!isHosted() && (await isAdmin(userId))) {
        backup.instance = await exportInstance(userId);
    }
    return backup;
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

async function writeAttachmentFile(attachment, subdir = 'tasks') {
    if (!attachment.data) return null;
    const buffer = Buffer.from(attachment.data, 'base64');
    const ext = path.extname(attachment.original_filename || '') || '';
    const storedFilename = `${generateUid()}${ext}`;
    const dir = path.join(getConfig().uploadPath, subdir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, storedFilename), buffer);
    return { storedFilename, size: buffer.length };
}

// A note links its files by stored name, attachment uid and note uid, all of
// which are new after an import.
function relinkNoteContent(content, oldNoteUid, newNoteUid, renamed) {
    if (!content) return content;
    let result = content;
    for (const { from, to } of renamed) {
        if (from.stored) result = result.split(from.stored).join(to.stored);
        if (from.uid) {
            result = result
                .split(`/attachments/${from.uid}/`)
                .join(`/attachments/${to.uid}/`);
        }
    }
    if (oldNoteUid && oldNoteUid !== newNoteUid) {
        result = result
            .split(`/api/note/${oldNoteUid}/attachments/`)
            .join(`/api/note/${newNoteUid}/attachments/`);
    }
    return result;
}

const IMPORT_STAT_KEYS = [
    'tags',
    'areas',
    'goals',
    'people',
    'projects',
    'tasks',
    'notes',
    'attachments',
    'inbox_items',
    'views',
];

// Imports one account's own records. ctx is shared across the accounts of
// an instance restore: userIdByUid resolves member links and personUids maps a
// backup's person uid to the restored one for assignments across accounts.
async function importOwnData(
    userId,
    backupData,
    options = { merge: true },
    ctx = {}
) {
    if (!backupData || !backupData.version || !backupData.data) {
        throw new Error('Invalid backup data format');
    }
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const merge = options.merge !== false;
    const d = backupData.data;
    const stats = {};
    for (const key of IMPORT_STAT_KEYS) {
        stats[key] = { created: 0, skipped: 0 };
    }
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
    // backup uid -> uid of the row it became, for relinking shares
    const uidRenames = {
        areas: {},
        goals: {},
        projects: {},
        tasks: {},
        notes: {},
    };
    const noteRename = (key, from, to) => {
        if (uidRenames[key]) uidRenames[key][from] = to;
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
            noteRename(key, uid, existing.uid);
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
        noteRename(key, uid, row.uid);
        return { row, created: true };
    };

    // Writes a backup's files for one new row and returns, per file, the old
    // and new stored name and uid, so links to them can be rewritten.
    const importAttachments = async (
        attachments,
        Model,
        ownerKey,
        ownerId,
        dir
    ) => {
        const renamed = [];
        for (const attachment of attachments || []) {
            const file = await writeAttachmentFile(attachment, dir);
            if (!file) continue;
            writtenFiles.push({ dir, name: file.storedFilename });
            const row = await Model.create(
                {
                    uid: generateUid(),
                    [ownerKey]: ownerId,
                    user_id: userId,
                    original_filename:
                        attachment.original_filename || file.storedFilename,
                    stored_filename: file.storedFilename,
                    file_size: file.size,
                    mime_type:
                        attachment.mime_type || 'application/octet-stream',
                    file_path: `${dir}/${file.storedFilename}`,
                },
                { transaction }
            );
            count('attachments', 'created');
            renamed.push({
                from: {
                    stored: attachment.stored_filename,
                    uid: attachment.uid,
                },
                to: { stored: row.stored_filename, uid: row.uid },
            });
        }
        return renamed;
    };

    try {
        // Restore the account's own profile and preferences (never email or
        // password, which are the account's login identity and must not change
        // just because a backup made on another install gets restored here).
        if (merge && backupData.user) {
            const bu = backupData.user;
            const profileUpdates = {
                name: bu.name,
                surname: bu.surname,
                appearance: bu.appearance,
                language: bu.language,
                timezone: bu.timezone,
                first_day_of_week: bu.first_day_of_week,
                telegram_bot_token: bu.telegram_bot_token,
                telegram_chat_id: bu.telegram_chat_id,
                telegram_allowed_users: bu.telegram_allowed_users,
                task_summary_enabled: bu.task_summary_enabled,
                task_summary_frequency: bu.task_summary_frequency,
                features: bu.features,
                today_settings: bu.today_settings,
                sidebar_settings: bu.sidebar_settings,
                ui_settings: bu.ui_settings,
                notification_preferences: bu.notification_preferences,
                ai_profile: bu.ai_profile,
                keyboard_shortcuts: bu.keyboard_shortcuts,
            };
            for (const key of Object.keys(profileUpdates)) {
                if (profileUpdates[key] === undefined)
                    delete profileUpdates[key];
            }
            if (bu.avatar_image_data) {
                const storedFilename = await writeUploadedImage(
                    bu.avatar_image_data,
                    'avatars',
                    'avatar'
                );
                if (storedFilename) {
                    writtenFiles.push({ dir: 'avatars', name: storedFilename });
                    profileUpdates.avatar_image = `/uploads/avatars/${storedFilename}`;
                }
            }
            if (Object.keys(profileUpdates).length) {
                await user.update(profileUpdates, { transaction });
            }
        }

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
                tag_type: tag.tag_type || 'user',
                pinned: !!tag.pinned,
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
                if (ctx.personUids) ctx.personUids[person.uid] = selfPerson.uid;
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
                    linked_user_id:
                        (person.linked_user_uid &&
                            ctx.userIdByUid?.[person.linked_user_uid]) ||
                        null,
                },
                { transaction }
            );
            uidMaps.people[person.uid] = row.uid;
            count('people', 'created');
        }
        const mapPerson = (personUid) =>
            personUid
                ? uidMaps.people[personUid] ||
                  ctx.personUids?.[personUid] ||
                  null
                : null;

        for (const project of d.projects || []) {
            const { row, created } = await upsertByUid(
                Project,
                'projects',
                project.uid,
                async () => {
                    let imageUrl = null;
                    if (project.cover_image) {
                        const storedFilename = await writeUploadedImage(
                            project.cover_image,
                            'projects',
                            'project'
                        );
                        if (storedFilename) {
                            writtenFiles.push({
                                dir: 'projects',
                                name: storedFilename,
                            });
                            imageUrl = `/api/uploads/projects/${storedFilename}`;
                        }
                    }
                    return {
                        name: project.name,
                        description: project.description,
                        pin_to_sidebar: project.pin_to_sidebar,
                        priority: project.priority,
                        due_date_at: project.due_date_at,
                        image_url: imageUrl,
                        color: project.color,
                        task_show_completed: project.task_show_completed,
                        task_sort_order: project.task_sort_order,
                        status: project.status || project.state,
                        is_maintenance: !!project.is_maintenance,
                        is_template: !!project.is_template,
                        template_category: project.template_category ?? null,
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
                    };
                }
            );
            if (created) {
                await importAttachments(
                    project.attachments,
                    ProjectAttachment,
                    'project_id',
                    row.id,
                    'project-files'
                );
            }
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
                    estimated_minutes: task.estimated_minutes ?? null,
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
                    habit_polarity: task.habit_polarity || 'build',
                    habit_unit: task.habit_unit,
                    habit_target_value: task.habit_target_value,
                    habit_schedule_days: task.habit_schedule_days,
                    habit_interval_days: task.habit_interval_days,
                    habit_time_of_day: task.habit_time_of_day,
                    habit_reminder_time: task.habit_reminder_time,
                    habit_strength: task.habit_strength || 0,
                    habit_color: task.habit_color,
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
                        value: completion.value ?? null,
                        note: completion.note ?? null,
                    },
                    { transaction }
                );
            }
            for (const attachment of task.attachments || []) {
                const file = await writeAttachmentFile(attachment);
                if (!file) continue;
                writtenFiles.push({ dir: 'tasks', name: file.storedFilename });
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
            if (created && note.attachments?.length) {
                const renamed = await importAttachments(
                    note.attachments,
                    NoteAttachment,
                    'note_id',
                    row.id,
                    'note-files'
                );
                const content = relinkNoteContent(
                    row.content,
                    note.uid,
                    row.uid,
                    renamed
                );
                if (content !== row.content) {
                    await row.update({ content }, { transaction });
                }
            }
            if (created && note.tag_uids?.length) {
                const tagIds = note.tag_uids
                    .map((u) => uidMaps.tags[u])
                    .filter(Boolean);
                if (tagIds.length) await row.setTags(tagIds, { transaction });
            }
        }

        for (const item of d.inbox_items || []) {
            const { row, created } = await upsertByUid(
                InboxItem,
                'inbox_items',
                item.uid,
                async () => ({
                    content: item.content,
                    title: item.title,
                    status: item.status,
                    source: item.source || 'manual',
                })
            );
            if (!created) continue;
            await importAttachments(
                item.attachments,
                InboxItemAttachment,
                'inbox_item_id',
                row.id,
                'inbox'
            );
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
        return { stats, uidRenames };
    } catch (error) {
        await transaction.rollback();
        for (const { dir, name } of writtenFiles) {
            const filePath = path.join(getConfig().uploadPath, dir, name);
            await fs.unlink(filePath).catch(() => {});
        }
        throw error;
    }
}

const RESOURCE_RENAME_KEYS = {
    area: 'areas',
    goal: 'goals',
    project: 'projects',
    task: 'tasks',
    note: 'notes',
};
const RESOURCE_MODELS = {
    area: Area,
    goal: Goal,
    project: Project,
    task: Task,
    note: Note,
};

const selfPersonUidIn = (backup) =>
    (backup?.data?.people || []).find((p) => p.is_self)?.uid || null;

// Creates the backup's accounts that are missing here (keeping their uid,
// password hash and role) and maps every backup account uid to a local user.
// Accounts that already exist are matched by uid, then email, and left as
// they are: a restore never changes someone's password or role.
async function restoreAccounts(userId, backupData, ctx, stats) {
    const instance = backupData.instance;
    const created = [];
    const transaction = await sequelize.transaction();
    try {
        if (backupData.user?.uid) ctx.userIdByUid[backupData.user.uid] = userId;

        for (const { account: a } of instance.accounts || []) {
            if (!a || !a.uid) continue;
            let user = await User.findOne({
                where: { uid: a.uid },
                transaction,
            });
            if (!user && a.email) {
                user = await User.findOne({
                    where: { email: a.email.trim().toLowerCase() },
                    transaction,
                });
            }
            if (user) {
                stats.accounts.skipped += 1;
            } else {
                // password_digest is set directly so the stored hash is kept
                // as is (the model only hashes the virtual password field).
                user = await User.create(
                    {
                        uid: a.uid,
                        email: a.email || null,
                        name: a.name,
                        surname: a.surname,
                        password_digest: a.password_digest || null,
                        email_verified: a.email_verified !== false,
                    },
                    { transaction }
                );
                if (a.role) {
                    await Role.update(
                        {
                            is_admin: !!a.role.is_admin,
                            role:
                                a.role.role ||
                                (a.role.is_admin ? 'admin' : 'user'),
                            capabilities: a.role.capabilities ?? null,
                        },
                        { where: { user_id: user.id }, transaction }
                    );
                }
                created.push({ user, account: a });
                stats.accounts.created += 1;
            }
            ctx.userIdByUid[a.uid] = user.id;
        }

        for (const { user, account } of created) {
            const creatorId = ctx.userIdByUid[account.created_by_uid];
            if (creatorId && creatorId !== user.id) {
                await user.update(
                    { created_by_user_id: creatorId },
                    { transaction, hooks: false }
                );
            }
        }
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    // Each account's own person keeps the backup's uid when it is free, so
    // tasks assigned to that person in anyone's data still point at it.
    const createdIds = new Set(created.map(({ user }) => user.id));
    const entries = [
        { id: userId, backup: backupData },
        ...(instance.accounts || []).map((e) => ({
            id: ctx.userIdByUid[e.account?.uid],
            backup: e.backup,
        })),
    ];
    for (const [index, { id, backup }] of entries.entries()) {
        const backupSelfUid = selfPersonUidIn(backup);
        if (!id || !backupSelfUid || (index > 0 && id === userId)) continue;
        const self = await Person.findOne({
            where: { user_id: id, linked_user_id: id },
        });
        if (!self) continue;
        if (createdIds.has(id) && self.uid !== backupSelfUid) {
            const taken = await Person.findOne({
                where: { uid: backupSelfUid },
                attributes: ['id'],
            });
            if (!taken) await self.update({ uid: backupSelfUid });
        }
        ctx.personUids[backupSelfUid] = self.uid;
    }
}

// Recreates groups, group shares and direct shares from an instance backup.
// Rows whose user or resource no longer resolves are skipped, and rows that
// already exist are left alone.
async function restoreSharing(userId, instance, ctx, renames, stats) {
    const userIdOf = (uid) => (uid ? ctx.userIdByUid[uid] || null : null);
    const resolveResource = async (type, uid, transaction) => {
        const key = RESOURCE_RENAME_KEYS[type];
        const Model = RESOURCE_MODELS[type];
        if (!key || !Model || !uid) return null;
        const localUid = renames[key][uid] || uid;
        const row = await Model.findOne({
            where: { uid: localUid },
            attributes: ['id'],
            transaction,
        });
        return row ? localUid : null;
    };

    const transaction = await sequelize.transaction();
    try {
        const groupIdOf = {};
        for (const g of instance.groups || []) {
            let group =
                (await UserGroup.findOne({
                    where: { uid: g.uid },
                    transaction,
                })) ||
                (await UserGroup.findOne({
                    where: { name: g.name },
                    transaction,
                }));
            if (group) {
                stats.groups.skipped += 1;
            } else {
                group = await UserGroup.create(
                    {
                        uid: g.uid,
                        name: g.name,
                        description: g.description ?? null,
                        created_by_user_id: userIdOf(g.created_by_uid),
                    },
                    { transaction }
                );
                stats.groups.created += 1;
            }
            groupIdOf[g.uid] = group.id;
            for (const memberUid of g.member_uids || []) {
                const memberId = userIdOf(memberUid);
                if (!memberId) continue;
                await UserGroupMember.findOrCreate({
                    where: { group_id: group.id, user_id: memberId },
                    transaction,
                });
            }
        }

        for (const gs of instance.group_shares || []) {
            const groupId = groupIdOf[gs.group_uid];
            const resourceUid = await resolveResource(
                gs.resource_type,
                gs.resource_uid,
                transaction
            );
            if (!groupId || !resourceUid) {
                stats.shares.skipped += 1;
                continue;
            }
            const grantedBy = userIdOf(gs.granted_by_uid) || userId;
            const [share, createdShare] = await GroupShare.findOrCreate({
                where: {
                    group_id: groupId,
                    resource_type: gs.resource_type,
                    resource_uid: resourceUid,
                },
                defaults: {
                    access_level: gs.access_level,
                    granted_by_user_id: grantedBy,
                },
                transaction,
            });
            stats.shares[createdShare ? 'created' : 'skipped'] += 1;
            for (const gp of gs.permissions || []) {
                const memberId = userIdOf(gp.user_uid);
                if (!memberId) continue;
                await GroupPermission.findOrCreate({
                    where: {
                        group_share_id: share.id,
                        user_id: memberId,
                        resource_type: gs.resource_type,
                        resource_uid: resourceUid,
                    },
                    defaults: {
                        access_level: gp.access_level || gs.access_level,
                        propagation: gp.propagation || 'direct',
                        granted_by_user_id: grantedBy,
                        status: gp.status || 'accepted',
                    },
                    transaction,
                });
            }
        }

        for (const p of instance.shares || []) {
            const recipientId = userIdOf(p.user_uid);
            const resourceUid = await resolveResource(
                p.resource_type,
                p.resource_uid,
                transaction
            );
            if (!recipientId || !resourceUid) {
                stats.shares.skipped += 1;
                continue;
            }
            const [, createdShare] = await Permission.findOrCreate({
                where: {
                    user_id: recipientId,
                    resource_type: p.resource_type,
                    resource_uid: resourceUid,
                },
                defaults: {
                    access_level: p.access_level,
                    propagation: p.propagation || 'direct',
                    granted_by_user_id: userIdOf(p.granted_by_uid) || userId,
                    status: p.status || 'accepted',
                },
                transaction,
            });
            stats.shares[createdShare ? 'created' : 'skipped'] += 1;
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

const addStats = (total, part) => {
    for (const [key, value] of Object.entries(part)) {
        total[key] = total[key] || { created: 0, skipped: 0 };
        total[key].created += value.created;
        total[key].skipped += value.skipped;
    }
};

async function importUserData(userId, backupData, options = { merge: true }) {
    const instance = backupData?.instance;
    const restoreInstance =
        instance &&
        options.merge !== false &&
        !isHosted() &&
        (await isAdmin(userId));
    if (!restoreInstance) {
        const { stats } = await importOwnData(userId, backupData, options);
        return stats;
    }

    const ctx = { userIdByUid: {}, personUids: {} };
    const extra = {
        accounts: { created: 0, skipped: 0 },
        groups: { created: 0, skipped: 0 },
        shares: { created: 0, skipped: 0 },
    };
    await restoreAccounts(userId, backupData, ctx, extra);

    const renames = {
        areas: {},
        goals: {},
        projects: {},
        tasks: {},
        notes: {},
    };
    const collect = (uidRenames) => {
        for (const key of Object.keys(renames)) {
            Object.assign(renames[key], uidRenames[key]);
        }
    };

    const own = await importOwnData(userId, backupData, options, ctx);
    const stats = own.stats;
    collect(own.uidRenames);
    for (const { account, backup } of instance.accounts || []) {
        const accountId = ctx.userIdByUid[account?.uid];
        // The importer's own entry is the top-level data, restored above.
        if (!accountId || accountId === userId || !backup?.data) continue;
        const result = await importOwnData(accountId, backup, options, ctx);
        addStats(stats, result.stats);
        collect(result.uidRenames);
    }

    await restoreSharing(userId, instance, ctx, renames, extra);
    return { ...stats, ...extra };
}

module.exports = { exportUserData, importUserData, FORMAT };
