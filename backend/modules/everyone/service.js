'use strict';

const { Op } = require('sequelize');
const { Task, Project } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const permissionSources = require('../../services/permissionSources');
const { getVisibleMemberIds } = require('../../services/workspaceMembers');
const peopleRepository = require('../people/repository');
const { getTaskIncludeConfig } = require('../tasks/queries/query-builders');
const { summarize, buildColumns } = require('./core/columns');
const moment = require('moment-timezone');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const { serializeTasks } = require('../tasks/core/serializers');
const { getDayHours } = require('../daily-plan/service');

const HIDDEN_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

const normalizeName = (name) => (name || '').trim().toLowerCase();

// Projects that are visible to me, and the subset of them shared with at
// least one other person. Phase A writes inherited project Permission rows
// for area/goal shares, so area- and goal-shared projects are already covered.
async function getProjectIds(userId) {
    const visibleWhere = await permissionsService.ownershipOrPermissionWhere(
        'project',
        userId
    );
    const visibleProjects = await Project.findAll({
        where: visibleWhere,
        attributes: ['id', 'uid'],
        raw: true,
    });
    if (visibleProjects.length === 0) {
        return { visibleProjectIds: [], sharedProjectIds: [] };
    }

    const sharedRows = await permissionSources.findAccepted(
        {
            resource_type: 'project',
            resource_uid: { [Op.in]: visibleProjects.map((p) => p.uid) },
        },
        ['resource_uid']
    );
    const sharedUids = new Set(sharedRows.map((r) => r.resource_uid));
    return {
        visibleProjectIds: visibleProjects.map((p) => p.id),
        sharedProjectIds: visibleProjects
            .filter((p) => sharedUids.has(p.uid))
            .map((p) => p.id),
    };
}

// The open tasks on the Everyone board and the people they belong to.
async function collectBoardTasks(userId) {
    const collaboratorUserIds = await getVisibleMemberIds(userId);
    const allUserIds = [userId, ...collaboratorUserIds];

    // Canonical self-person per user (user_id === linked_user_id).
    const selfPeople = (
        await peopleRepository.findSelfPeopleByUserIds(allUserIds)
    ).filter((p) => p.user_id === p.linked_user_id);

    const userIdToSelfPersonUid = {};
    const personByUid = {};
    const nameToSelfPersonUid = {};
    for (const p of selfPeople) {
        userIdToSelfPersonUid[p.linked_user_id] = p.uid;
        personByUid[p.uid] = p;
        nameToSelfPersonUid[normalizeName(p.name)] = p.uid;
    }
    const selfPersonUids = new Set(Object.values(userIdToSelfPersonUid));
    const collaboratorPersonUids = Array.from(selfPersonUids);

    // The viewer's address book can hold a plain contact card that stands in
    // for a collaborator - linked to their account, or just sharing a name.
    // Fold each such card into the collaborator's canonical column so one
    // person is never listed twice.
    const viewerPeople = await peopleRepository.findAllByUser(userId, {
        archived: null,
    });
    const personUidAlias = {};
    for (const p of viewerPeople) {
        if (selfPersonUids.has(p.uid)) continue;
        if (p.linked_user_id && userIdToSelfPersonUid[p.linked_user_id]) {
            personUidAlias[p.uid] = userIdToSelfPersonUid[p.linked_user_id];
        } else if (
            !p.linked_user_id &&
            nameToSelfPersonUid[normalizeName(p.name)]
        ) {
            personUidAlias[p.uid] = nameToSelfPersonUid[normalizeName(p.name)];
        }
    }

    const { visibleProjectIds, sharedProjectIds } = await getProjectIds(userId);

    const orConditions = [];
    if (sharedProjectIds.length > 0) {
        orConditions.push({ project_id: { [Op.in]: sharedProjectIds } });
    }
    const assigneeUids = [
        ...collaboratorPersonUids,
        ...Object.keys(personUidAlias),
    ];
    if (assigneeUids.length > 0) {
        // Assignment alone never grants read access: a collaborator's
        // self-assigned task in their private project stays off the board.
        const readable = await permissionsService.ownershipOrPermissionWhere(
            'task',
            userId
        );
        const readableConditions = [readable];
        if (visibleProjectIds.length > 0) {
            readableConditions.push({
                project_id: { [Op.in]: visibleProjectIds },
            });
        }
        orConditions.push({
            [Op.and]: [
                { assigned_to: { [Op.in]: assigneeUids } },
                { [Op.or]: readableConditions },
            ],
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

    // Genuine non-account people (e.g. children) enter the roster via
    // assignment; an aliased contact card never gets its own column.
    for (const task of tasks) {
        const a = task.AssignedTo;
        if (!a || selfPersonUids.has(a.uid) || personUidAlias[a.uid]) continue;
        if (!personByUid[a.uid]) personByUid[a.uid] = a;
    }

    return { tasks, userIdToSelfPersonUid, personByUid, personUidAlias };
}

async function getEveryoneDashboard(userId, timezone) {
    const tz = getSafeTimezone(timezone);
    const { tasks, userIdToSelfPersonUid, personByUid, personUidAlias } =
        await collectBoardTasks(userId);

    const columns = await buildColumns(
        tasks,
        userId,
        userIdToSelfPersonUid,
        personByUid,
        personUidAlias,
        tz
    );

    return { columns, summary: summarize(columns) };
}

// The Everyone board laid out over time: a lane per person with the tasks
// whose start or due date falls in [from, from + days). The viewer's own
// lane also holds their private tasks, which only they can see.
async function getEveryoneTimeline(user, timezone, { from, days } = {}) {
    const tz = getSafeTimezone(timezone);
    const span = Math.min(Math.max(parseInt(days, 10) || 14, 1), 62);
    const start =
        from && moment(from, 'YYYY-MM-DD', true).isValid()
            ? moment.tz(from, 'YYYY-MM-DD', tz)
            : moment.tz(tz).startOf('day');
    const windowStart = start.clone().startOf('day');
    const windowEnd = start
        .clone()
        .add(span - 1, 'days')
        .endOf('day');

    const { tasks, userIdToSelfPersonUid, personByUid, personUidAlias } =
        await collectBoardTasks(user.id);

    const ownTasks = await Task.findAll({
        where: {
            [Op.and]: [
                { user_id: user.id },
                { status: { [Op.notIn]: HIDDEN_STATUSES } },
                { parent_task_id: null },
                { recurring_parent_id: null },
                { habit_mode: false },
                {
                    [Op.or]: [
                        { start_date: { [Op.ne]: null } },
                        { due_date: { [Op.ne]: null } },
                    ],
                },
            ],
        },
        include: getTaskIncludeConfig(),
        distinct: true,
    });
    const seen = new Set(tasks.map((task) => task.id));
    const allTasks = [
        ...tasks,
        ...ownTasks.filter((task) => !seen.has(task.id)),
    ];
    for (const task of allTasks) {
        const a = task.AssignedTo;
        if (a && !personUidAlias[a.uid] && !personByUid[a.uid]) {
            personByUid[a.uid] = a;
        }
    }

    const inWindow = (task) => {
        const first = task.start_date || task.due_date;
        const last = task.due_date || task.start_date;
        if (!first) return false;
        const lo = first < last ? first : last;
        const hi = first < last ? last : first;
        return (
            moment(lo).isSameOrBefore(windowEnd) &&
            moment(hi).isSameOrAfter(windowStart)
        );
    };

    const selfPersonUid = userIdToSelfPersonUid[user.id] || null;
    const byPerson = new Map();
    for (const uid of Object.values(userIdToSelfPersonUid)) {
        byPerson.set(uid, []);
    }
    for (const task of allTasks) {
        if (!inWindow(task)) continue;
        const assignedUid = task.assigned_to
            ? personUidAlias[task.assigned_to] || task.assigned_to
            : null;
        const personUid =
            assignedUid || userIdToSelfPersonUid[task.user_id] || null;
        if (!personUid) continue;
        if (!byPerson.has(personUid)) byPerson.set(personUid, []);
        byPerson.get(personUid).push(task);
    }

    const lanes = [];
    for (const [personUid, laneTasks] of byPerson.entries()) {
        const person = personByUid[personUid];
        if (!person) continue;
        const isSelf = personUid === selfPersonUid;
        if (laneTasks.length === 0 && !person.linked_user_id && !isSelf) {
            continue;
        }
        lanes.push({
            person: {
                uid: person.uid,
                name: person.name,
                color: person.color || null,
                linked_user_id: person.linked_user_id || null,
            },
            is_self: isSelf,
            tasks: await serializeTasks(laneTasks, tz, {
                preserveOriginalName: true,
            }),
        });
    }
    lanes.sort((a, b) => {
        if (a.is_self !== b.is_self) return a.is_self ? -1 : 1;
        const aLinked = a.person.linked_user_id != null;
        const bLinked = b.person.linked_user_id != null;
        if (aLinked !== bLinked) return aLinked ? -1 : 1;
        return a.person.name.localeCompare(b.person.name);
    });

    return {
        from: windowStart.format('YYYY-MM-DD'),
        days: span,
        day_hours: await getDayHours(user),
        lanes,
    };
}

// One group's board: a column per member, holding the tasks assigned to them
// that the viewer is allowed to read. Unlike the Everyone board there is no
// shared-project clause, so only assignment places a task in a column.
async function getGroupBoard(viewerId, memberUserIds, timezone) {
    const tz = getSafeTimezone(timezone);

    const selfPeople =
        await peopleRepository.findSelfPeopleByUserIds(memberUserIds);
    const userIdToSelfPersonUid = {};
    const personByUid = {};
    for (const p of selfPeople) {
        userIdToSelfPersonUid[p.linked_user_id] = p.uid;
        personByUid[p.uid] = p;
    }
    const personUids = Object.values(userIdToSelfPersonUid);

    let tasks = [];
    if (personUids.length > 0) {
        const readable = await permissionsService.ownershipOrPermissionWhere(
            'task',
            viewerId
        );
        tasks = await Task.findAll({
            where: {
                [Op.and]: [
                    { status: { [Op.notIn]: HIDDEN_STATUSES } },
                    { parent_task_id: null },
                    { recurring_parent_id: null },
                    { habit_mode: false },
                    { assigned_to: { [Op.in]: personUids } },
                    readable,
                ],
            },
            include: getTaskIncludeConfig(),
            distinct: true,
        });
    }

    const columns = await buildColumns(
        tasks,
        viewerId,
        userIdToSelfPersonUid,
        personByUid,
        {},
        tz
    );

    return { columns, summary: summarize(columns) };
}

module.exports = { getEveryoneDashboard, getEveryoneTimeline, getGroupBoard };
