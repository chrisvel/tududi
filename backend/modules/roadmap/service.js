'use strict';

const moment = require('moment-timezone');
const roadmapRepository = require('./repository');
const permissionsService = require('../../services/permissionsService');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const {
    getSafeTimezone,
    utcToUserDateString,
} = require('../../utils/timezone-utils');
const {
    dateSpan,
    buildProjectRow,
    isProjectShown,
    placedAreaId,
    rollUp,
} = require('./core/rollup');

const MAX_DAYS = 186;

// The window asked for, or the current calendar quarter in the user's timezone.
function resolveWindow(from, days, timezone) {
    if (from === undefined) {
        const quarter = moment.tz(timezone).startOf('quarter');
        return {
            windowFrom: quarter.format('YYYY-MM-DD'),
            windowTo: quarter.clone().endOf('quarter').format('YYYY-MM-DD'),
        };
    }
    const start = moment.utc(from, 'YYYY-MM-DD', true);
    if (!start.isValid()) {
        throw new ValidationError('from must be a YYYY-MM-DD date');
    }
    const span = Math.min(Math.max(parseInt(days, 10) || 92, 1), MAX_DAYS);
    return {
        windowFrom: start.format('YYYY-MM-DD'),
        windowTo: start
            .clone()
            .add(span - 1, 'days')
            .format('YYYY-MM-DD'),
    };
}

async function resolveAreaId(userId, areaUid) {
    if (!areaUid) return null;
    const area = await roadmapRepository.findAreaByUid(String(areaUid));
    const access = area
        ? await permissionsService.getAccess(userId, 'area', area.uid)
        : permissionsService.ACCESS.NONE;
    if (access === permissionsService.ACCESS.NONE) {
        throw new NotFoundError('Area not found');
    }
    return area.id;
}

function serializeTaskDates(task, timezone) {
    const start_date = task.start_date
        ? utcToUserDateString(task.start_date, timezone)
        : null;
    const due_date = task.due_date
        ? utcToUserDateString(task.due_date, timezone)
        : null;
    return {
        ...task,
        start_date,
        due_date,
        span: dateSpan(start_date, due_date),
    };
}

function serializeProjectDates(project, timezone) {
    return {
        ...project,
        start_date: project.start_date_at
            ? utcToUserDateString(project.start_date_at, timezone)
            : null,
        due_date: project.due_date_at
            ? utcToUserDateString(project.due_date_at, timezone)
            : null,
    };
}

function buildAreaRow(area, projects) {
    const dates = rollUp(projects);
    return {
        uid: area ? area.uid : null,
        name: area ? area.name : null,
        color: area ? area.color : null,
        start: dates.start,
        end: dates.end,
        projects,
    };
}

// Goals, areas, projects and tasks for one stretch of time. Only top-level
// project tasks count: bars for a project and area summarise them.
async function getRoadmap(user, timezone, { from, days, areaUid } = {}) {
    const tz = getSafeTimezone(timezone);
    const { windowFrom, windowTo } = resolveWindow(from, days, tz);
    const areaId = await resolveAreaId(user.id, areaUid);

    const [areas, positions, projects, overrides, goals] = await Promise.all([
        roadmapRepository.findVisibleAreas(user.id),
        roadmapRepository.findAreaPositions(user.id),
        roadmapRepository.findVisibleProjects(user.id),
        roadmapRepository.findAreaOverrides(user.id),
        roadmapRepository.findDatedGoals(user.id, areaId),
    ]);

    const areaById = new Map(areas.map((area) => [area.id, area]));
    const placed = projects
        .map((project) => {
            const placedId = placedAreaId(project, user.id, overrides);
            return {
                project: serializeProjectDates(project, tz),
                // A shared project's area the user cannot see counts as none
                area: areaById.get(placedId) || null,
            };
        })
        .filter(({ area }) => !areaId || (area && area.id === areaId));

    const tasks = await roadmapRepository.findProjectTasks(
        user.id,
        placed.map(({ project }) => project.id)
    );
    const tasksByProject = new Map();
    for (const task of tasks) {
        if (!tasksByProject.has(task.project_id)) {
            tasksByProject.set(task.project_id, []);
        }
        tasksByProject.get(task.project_id).push(serializeTaskDates(task, tz));
    }

    const projectsByArea = new Map();
    for (const { project, area } of placed) {
        const row = buildProjectRow(
            project,
            tasksByProject.get(project.id) || [],
            windowFrom,
            windowTo
        );
        if (!isProjectShown(project, row, windowFrom, windowTo)) continue;
        const key = area ? area.id : null;
        if (!projectsByArea.has(key)) projectsByArea.set(key, []);
        projectsByArea.get(key).push(row);
    }

    // Areas in the user's own order, then by name, with loose projects last
    const orderedAreas = [...areas].sort((a, b) => {
        const posA = positions.has(a.id) ? positions.get(a.id) : Infinity;
        const posB = positions.has(b.id) ? positions.get(b.id) : Infinity;
        return posA === posB ? 0 : posA - posB;
    });
    const areaRows = orderedAreas
        .filter((area) => projectsByArea.has(area.id))
        .map((area) => buildAreaRow(area, projectsByArea.get(area.id)));
    if (projectsByArea.has(null)) {
        areaRows.push(buildAreaRow(null, projectsByArea.get(null)));
    }

    const inWindow = (goal) =>
        goal.target_date >= windowFrom && goal.target_date <= windowTo;

    return {
        from: windowFrom,
        to: windowTo,
        goals: goals.filter(inWindow).map((goal) => ({
            uid: goal.uid,
            title: goal.title,
            target_date: goal.target_date,
            status: goal.status,
            area_uid: goal.Area ? goal.Area.uid : null,
        })),
        goals_outside: goals.filter((goal) => !inWindow(goal)).length,
        areas: areaRows,
    };
}

module.exports = { getRoadmap };
