'use strict';

const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { Task, Project, Permission } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const peopleRepository = require('../people/repository');
const { getTaskIncludeConfig } = require('../tasks/queries/query-builders');
const { serializeTasks } = require('../tasks/core/serializers');
const { getSafeTimezone } = require('../../utils/timezone-utils');

const HIDDEN_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

const BUCKET_KEYS = ['overdue', 'today', 'tomorrow', 'upcoming', 'no_date'];

// The set of user ids that share something with me or that I share something
// with (accepted, top-level grants only).
async function getCollaboratorUserIds(userId) {
    const [sharedToMe, sharedByMe] = await Promise.all([
        Permission.findAll({
            where: {
                user_id: userId,
                status: 'accepted',
                propagation: 'direct',
            },
            attributes: ['granted_by_user_id'],
            raw: true,
        }),
        Permission.findAll({
            where: {
                granted_by_user_id: userId,
                status: 'accepted',
                propagation: 'direct',
            },
            attributes: ['user_id'],
            raw: true,
        }),
    ]);

    const ids = new Set();
    sharedToMe.forEach((r) => ids.add(r.granted_by_user_id));
    sharedByMe.forEach((r) => ids.add(r.user_id));
    ids.delete(userId);
    return Array.from(ids);
}

// Projects that are visible to me AND shared with at least one other person.
// Phase A writes inherited project Permission rows for area/goal shares, so
// area- and goal-shared projects are already covered.
async function getSharedProjectIds(userId) {
    const visibleWhere = await permissionsService.ownershipOrPermissionWhere(
        'project',
        userId
    );
    const visibleProjects = await Project.findAll({
        where: visibleWhere,
        attributes: ['id', 'uid'],
        raw: true,
    });
    if (visibleProjects.length === 0) return [];

    const sharedRows = await Permission.findAll({
        where: {
            resource_type: 'project',
            resource_uid: { [Op.in]: visibleProjects.map((p) => p.uid) },
            status: 'accepted',
        },
        attributes: ['resource_uid'],
        raw: true,
    });
    const sharedUids = new Set(sharedRows.map((r) => r.resource_uid));
    return visibleProjects
        .filter((p) => sharedUids.has(p.uid))
        .map((p) => p.id);
}

function emptyBuckets() {
    return {
        overdue: [],
        today: [],
        tomorrow: [],
        upcoming: [],
        no_date: [],
    };
}

function bucketForDue(dueDate, tz) {
    if (!dueDate) return 'no_date';
    const due = moment.utc(dueDate).tz(tz).startOf('day');
    const today = moment.tz(tz).startOf('day');
    const diff = due.diff(today, 'days');
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff <= 7) return 'upcoming';
    return null; // more than a week out - not shown on the board
}

async function getEveryoneDashboard(userId, timezone) {
    const tz = getSafeTimezone(timezone);

    const collaboratorUserIds = await getCollaboratorUserIds(userId);
    const allUserIds = [userId, ...collaboratorUserIds];

    // Canonical self-person per user (user_id === linked_user_id).
    const selfPeople = (
        await peopleRepository.findSelfPeopleByUserIds(allUserIds)
    ).filter((p) => p.user_id === p.linked_user_id);

    const userIdToSelfPersonUid = {};
    const personByUid = {};
    for (const p of selfPeople) {
        userIdToSelfPersonUid[p.linked_user_id] = p.uid;
        personByUid[p.uid] = p;
    }
    const collaboratorPersonUids = Object.values(userIdToSelfPersonUid);

    const sharedProjectIds = await getSharedProjectIds(userId);

    const orConditions = [];
    if (sharedProjectIds.length > 0) {
        orConditions.push({ project_id: { [Op.in]: sharedProjectIds } });
    }
    if (collaboratorPersonUids.length > 0) {
        orConditions.push({
            assigned_to: { [Op.in]: collaboratorPersonUids },
        });
    }

    let tasks = [];
    if (orConditions.length > 0) {
        tasks = await Task.findAll({
            where: {
                [Op.and]: [
                    { status: { [Op.notIn]: HIDDEN_STATUSES } },
                    { parent_task_id: null },
                    { recurring_parent_id: null },
                    { habit_mode: false },
                    { [Op.or]: orConditions },
                ],
            },
            include: getTaskIncludeConfig(),
            distinct: true,
        });
    }

    // Non-account people (e.g. children) enter the roster via assignment.
    for (const task of tasks) {
        if (task.AssignedTo && !personByUid[task.AssignedTo.uid]) {
            personByUid[task.AssignedTo.uid] = task.AssignedTo;
        }
    }

    return {
        columns: await buildColumns(
            tasks,
            userId,
            userIdToSelfPersonUid,
            personByUid,
            tz
        ),
    };
}

async function buildColumns(
    tasks,
    userId,
    userIdToSelfPersonUid,
    personByUid,
    tz
) {
    const selfPersonUid = userIdToSelfPersonUid[userId] || null;

    // personUid -> { raw buckets }
    const byPerson = new Map();
    const ensure = (personUid) => {
        if (!byPerson.has(personUid)) byPerson.set(personUid, emptyBuckets());
        return byPerson.get(personUid);
    };

    // Every account person gets a column even with no tasks.
    for (const uid of Object.values(userIdToSelfPersonUid)) ensure(uid);

    for (const task of tasks) {
        const personUid =
            task.assigned_to || userIdToSelfPersonUid[task.user_id] || null;
        if (!personUid) continue;
        const bucket = bucketForDue(task.due_date, tz);
        if (!bucket) continue;
        ensure(personUid)[bucket].push(task);
    }

    const columns = [];
    for (const [personUid, buckets] of byPerson.entries()) {
        const person = personByUid[personUid];
        if (!person) continue;
        const isSelf = personUid === selfPersonUid;
        const total = BUCKET_KEYS.reduce((n, k) => n + buckets[k].length, 0);
        // Skip empty non-account people; keep empty account people.
        if (total === 0 && !person.linked_user_id && !isSelf) continue;

        const serialized = {};
        const counts = {};
        for (const key of BUCKET_KEYS) {
            serialized[key] = await serializeTasks(buckets[key], tz);
            counts[key] = buckets[key].length;
        }

        columns.push({
            person: {
                uid: person.uid,
                name: person.name,
                color: person.color || null,
                relationship_type: person.relationship_type || null,
                linked_user_id: person.linked_user_id || null,
            },
            is_self: isSelf,
            counts,
            ...serialized,
        });
    }

    columns.sort((a, b) => {
        if (a.is_self !== b.is_self) return a.is_self ? -1 : 1;
        const aLinked = a.person.linked_user_id != null;
        const bLinked = b.person.linked_user_id != null;
        if (aLinked !== bLinked) return aLinked ? -1 : 1;
        return a.person.name.localeCompare(b.person.name);
    });

    return columns;
}

module.exports = { getEveryoneDashboard };
