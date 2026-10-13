'use strict';

// A scope narrows a list request to one area (optionally one project inside
// it) and a set of tags, the way the Focus chip in the app does. The client
// sends area_uid, project_uid and tags as plain query params; nothing is
// applied from stored settings, so the REST API, MCP and Telegram see the
// same lists as before unless they ask for a scope themselves.

const { Op } = require('sequelize');
const { Area, Project, UserProjectArea } = require('../models');
const permissionsService = require('./permissionsService');
const searchRepository = require('../modules/search/repository');

function splitTags(value) {
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return [...new Set(raw.map((name) => String(name).trim()).filter(Boolean))];
}

// { areaUid, projectUid, tagNames } from a query object, or null when the
// request carries no scope at all so callers can skip every lookup.
function parseScopeParams(query = {}) {
    const areaUid =
        typeof query.area_uid === 'string' && query.area_uid.trim()
            ? query.area_uid.trim()
            : null;
    const projectUid =
        typeof query.project_uid === 'string' && query.project_uid.trim()
            ? query.project_uid.trim()
            : null;
    const tagNames =
        query.tags !== undefined && query.tags !== null && query.tags !== ''
            ? splitTags(query.tags)
            : [];

    if (!areaUid && !projectUid && tagNames.length === 0) {
        return null;
    }
    return { areaUid, projectUid, tagNames };
}

async function canRead(userId, resourceType, uid) {
    const level = await permissionsService.getAccess(userId, resourceType, uid);
    return level !== permissionsService.ACCESS.NONE;
}

// Projects that sit in an area as this user sees them: owned projects by
// their own area_id, shared projects by the user's personal placement when
// one exists (the same rule the Projects page applies).
async function projectIdsInArea(areaId, userId) {
    const [projects, overrides] = await Promise.all([
        Project.findAll({
            where: { area_id: areaId },
            attributes: ['id', 'user_id'],
            raw: true,
        }),
        UserProjectArea.findAll({
            where: { user_id: userId },
            attributes: ['project_id', 'area_id'],
            raw: true,
        }),
    ]);
    const overrideByProject = new Map(
        overrides.map((row) => [row.project_id, row.area_id])
    );
    const ids = new Set();
    projects.forEach((project) => {
        const override = overrideByProject.get(project.id);
        const movedElsewhere =
            project.user_id !== userId &&
            override !== undefined &&
            override !== areaId;
        if (!movedElsewhere) ids.add(project.id);
    });
    if (overrides.length > 0) {
        const movedHere = overrides
            .filter((row) => row.area_id === areaId)
            .map((row) => row.project_id);
        if (movedHere.length > 0) {
            const shared = await Project.findAll({
                where: {
                    id: { [Op.in]: movedHere },
                    user_id: { [Op.ne]: userId },
                },
                attributes: ['id'],
                raw: true,
            });
            shared.forEach((project) => ids.add(project.id));
        }
    }
    return [...ids];
}

// Resolves the uids and names of a scope into ids the where builders use.
// A scope that names something missing, inaccessible or contradictory
// (a project outside the area, an unknown tag) matches nothing rather than
// failing the request: the lists simply come back empty.
async function resolveScope(query, userId) {
    const parsed = parseScopeParams(query);
    if (!parsed) return null;

    const scope = {
        areaId: null,
        projectIds: null,
        projectId: null,
        tagIds: null,
        matchesNothing: false,
    };

    if (parsed.areaUid) {
        const area = await Area.findOne({
            where: { uid: parsed.areaUid },
            attributes: ['id', 'uid'],
            raw: true,
        });
        if (!area || !(await canRead(userId, 'area', area.uid))) {
            return { ...scope, matchesNothing: true };
        }
        scope.areaId = area.id;
        scope.projectIds = await projectIdsInArea(area.id, userId);
    }

    if (parsed.projectUid) {
        const project = await Project.findOne({
            where: { uid: parsed.projectUid },
            attributes: ['id', 'uid'],
            raw: true,
        });
        if (!project || !(await canRead(userId, 'project', project.uid))) {
            return { ...scope, matchesNothing: true };
        }
        if (scope.projectIds && !scope.projectIds.includes(project.id)) {
            return { ...scope, matchesNothing: true };
        }
        scope.projectId = project.id;
    }

    if (parsed.tagNames.length > 0) {
        const tagIds = await searchRepository.findTagIdsByNames(
            userId,
            parsed.tagNames
        );
        if (tagIds.length < parsed.tagNames.length) {
            return { ...scope, matchesNothing: true };
        }
        scope.tagIds = tagIds;
    }

    return scope;
}

const NOTHING = { id: { [Op.in]: [] } };

function andAll(parts) {
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return { [Op.and]: parts };
}

// Tasks are in the area when they carry it directly or through their
// project. Tags use AND semantics: a task must carry every scoped tag.
async function taskScopeWhere(scope) {
    if (!scope) return null;
    if (scope.matchesNothing) return NOTHING;
    const parts = [];
    if (scope.projectId !== null) {
        parts.push({ project_id: scope.projectId });
    } else if (scope.areaId !== null) {
        parts.push({
            [Op.or]: [
                { area_id: scope.areaId },
                { project_id: { [Op.in]: scope.projectIds } },
            ],
        });
    }
    if (scope.tagIds) {
        const ids = await searchRepository.findTaskIdsWithAllTags(scope.tagIds);
        parts.push({ id: { [Op.in]: ids } });
    }
    return andAll(parts);
}

async function projectScopeWhere(scope) {
    if (!scope) return null;
    if (scope.matchesNothing) return NOTHING;
    const parts = [];
    if (scope.projectId !== null) {
        parts.push({ id: scope.projectId });
    } else if (scope.areaId !== null) {
        parts.push({ id: { [Op.in]: scope.projectIds } });
    }
    if (scope.tagIds) {
        const ids = await searchRepository.findProjectIdsWithAllTags(
            scope.tagIds
        );
        parts.push({ id: { [Op.in]: ids } });
    }
    return andAll(parts);
}

// Notes only know their project, so an area scope means "notes of a project
// in that area".
async function noteScopeWhere(scope) {
    if (!scope) return null;
    if (scope.matchesNothing) return NOTHING;
    const parts = [];
    if (scope.projectId !== null) {
        parts.push({ project_id: scope.projectId });
    } else if (scope.areaId !== null) {
        parts.push({ project_id: { [Op.in]: scope.projectIds } });
    }
    if (scope.tagIds) {
        const ids = await searchRepository.findNoteIdsWithAllTags(scope.tagIds);
        parts.push({ id: { [Op.in]: ids } });
    }
    return andAll(parts);
}

// Merges a scope fragment into an existing where without losing either
// side's own Op.and / Op.or keys.
function withScope(where, scopeWhere) {
    if (!scopeWhere) return where;
    if (!where) return scopeWhere;
    return { [Op.and]: [where, scopeWhere] };
}

module.exports = {
    parseScopeParams,
    resolveScope,
    taskScopeWhere,
    projectScopeWhere,
    noteScopeWhere,
    withScope,
};
