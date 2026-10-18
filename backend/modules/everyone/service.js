'use strict';

const { Op } = require('sequelize');
const { Task, Project } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const permissionSources = require('../../services/permissionSources');
const { getWorkspaceUserIds } = require('../../services/workspaceMembers');
const peopleRepository = require('../people/repository');
const { getTaskIncludeConfig } = require('../tasks/queries/query-builders');
const { summarize, buildColumns } = require('./core/columns');
const { getSafeTimezone } = require('../../utils/timezone-utils');

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

async function getEveryoneDashboard(userId, timezone) {
    const tz = getSafeTimezone(timezone);

    const collaboratorUserIds = await getWorkspaceUserIds(userId);
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

module.exports = { getEveryoneDashboard, getGroupBoard };
