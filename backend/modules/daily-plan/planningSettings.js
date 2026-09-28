'use strict';

// Which open tasks count as "Everything else" (the suggested group) when
// planning the day, stored in ui_settings.planning next to candidateOrder.
// Profile > Planning describes these, so change both together.
const { Project } = require('../../models');
const { ValidationError } = require('../../shared/errors');

const PROJECT_STATUSES = [...Project.getAttributes().status.values];
const TIE_BREAKS = ['recently_touched', 'newest', 'oldest'];
const STALE_AFTER_DAYS = [null, 90, 180];
const HORIZON_DAYS = [1, 3, 7];
const MAX_SUGGESTIONS = [10, 20, 50];
const MAX_EXCLUDED_PROJECTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SUGGESTIONS = Object.freeze({
    projectStatuses: ['in_progress'],
    includeNoProject: true,
    excludedProjectIds: [],
    tieBreak: 'recently_touched',
    staleAfterDays: null,
    horizonDays: 3,
    maxSuggestions: 20,
});

const SUGGESTION_KEYS = Object.keys(DEFAULT_SUGGESTIONS);

const isProjectId = (value) => Number.isInteger(value) && value > 0;

const normalizers = {
    projectStatuses: (value) =>
        Array.isArray(value)
            ? PROJECT_STATUSES.filter((status) => value.includes(status))
            : undefined,
    includeNoProject: (value) =>
        typeof value === 'boolean' ? value : undefined,
    excludedProjectIds: (value) =>
        Array.isArray(value)
            ? [...new Set(value.filter(isProjectId))].slice(
                  0,
                  MAX_EXCLUDED_PROJECTS
              )
            : undefined,
    tieBreak: (value) => (TIE_BREAKS.includes(value) ? value : undefined),
    staleAfterDays: (value) =>
        STALE_AFTER_DAYS.includes(value) ? value : undefined,
    horizonDays: (value) => (HORIZON_DAYS.includes(value) ? value : undefined),
    maxSuggestions: (value) =>
        MAX_SUGGESTIONS.includes(value) ? value : undefined,
};

// Reads the saved planning object. A missing or unknown value falls back to
// its default, so an old or hand-edited setting still works.
function normalizeSuggestionSettings(planning) {
    const saved = planning && typeof planning === 'object' ? planning : {};
    const result = {};
    for (const key of SUGGESTION_KEYS) {
        const value = normalizers[key](saved[key]);
        result[key] =
            value === undefined
                ? structuredClone(DEFAULT_SUGGESTIONS[key])
                : value;
    }
    return result;
}

// Checks a partial update from the client. Unlike normalize, anything
// unknown is rejected so it is never stored.
function validateSuggestionUpdate(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('Send the settings as an object');
    }
    const unknown = Object.keys(body).filter(
        (key) => !SUGGESTION_KEYS.includes(key)
    );
    if (unknown.length > 0) {
        throw new ValidationError(`Unknown settings: ${unknown.join(', ')}`);
    }

    const update = {};
    for (const key of Object.keys(body)) {
        const value = body[key];
        const normalized = normalizers[key](value);
        const exact =
            normalized !== undefined &&
            (!Array.isArray(value) || normalized.length === value.length);
        if (!exact) {
            throw new ValidationError(invalidMessage(key));
        }
        update[key] = normalized;
    }
    return update;
}

function invalidMessage(key) {
    switch (key) {
        case 'projectStatuses':
            return `projectStatuses must list statuses from ${PROJECT_STATUSES.join(', ')}, each once`;
        case 'includeNoProject':
            return 'includeNoProject must be true or false';
        case 'excludedProjectIds':
            return `excludedProjectIds must list at most ${MAX_EXCLUDED_PROJECTS} project ids, each once`;
        case 'tieBreak':
            return `tieBreak must be one of ${TIE_BREAKS.join(', ')}`;
        case 'staleAfterDays':
            return 'staleAfterDays must be null, 90 or 180';
        case 'horizonDays':
            return `horizonDays must be one of ${HORIZON_DAYS.join(', ')}`;
        default:
            return `maxSuggestions must be one of ${MAX_SUGGESTIONS.join(', ')}`;
    }
}

const timeOf = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
};

const projectStatusOf = (task) =>
    task.Project?.status ?? task.project?.status ?? null;

// Whether an open task may be suggested under these settings. Only the
// suggested group uses this: overdue, due-today and started tasks always
// show.
function isSuggestible(task, settings, now = Date.now()) {
    const deferUntil = timeOf(task.defer_until);
    if (deferUntil !== null && deferUntil > now) return false;

    const due = timeOf(task.due_date);
    if (due !== null && due > now + settings.horizonDays * DAY_MS) {
        return false;
    }

    if (settings.staleAfterDays !== null) {
        const touched = timeOf(task.updated_at);
        if (
            touched !== null &&
            touched < now - settings.staleAfterDays * DAY_MS
        ) {
            return false;
        }
    }

    if (!task.project_id) return settings.includeNoProject;
    if (settings.excludedProjectIds.includes(task.project_id)) return false;
    return settings.projectStatuses.includes(projectStatusOf(task));
}

module.exports = {
    PROJECT_STATUSES,
    TIE_BREAKS,
    STALE_AFTER_DAYS,
    HORIZON_DAYS,
    MAX_SUGGESTIONS,
    DEFAULT_SUGGESTIONS,
    normalizeSuggestionSettings,
    validateSuggestionUpdate,
    isSuggestible,
};
