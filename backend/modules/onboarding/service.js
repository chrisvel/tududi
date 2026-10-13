'use strict';

const moment = require('moment-timezone');
const { Op } = require('sequelize');
const {
    User,
    Area,
    Goal,
    Project,
    Task,
    Tag,
    Note,
    sequelize,
} = require('../../models');
const { ValidationError } = require('../../shared/errors');
const { validateTagName } = require('../tags/tagsService');
const entitlements = require('../../services/entitlementsService');
const {
    processDueDateForStorage,
    getSafeTimezone,
} = require('../../utils/timezone-utils');

// The welcome screen's starters. The frontend owns the copy (it is
// translated there) and sends the resolved structure; this side bounds it,
// resolves relative dates in the user's timezone and writes it in one
// transaction. "empty" records that the person chose to start with nothing.
const STARTER_KEYS = ['household', 'work-side', 'studying', 'simple', 'empty'];
const LIMITS = { areas: 6, projects: 8, tasks: 15, habits: 4 };
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DONE_STATUSES = [Task.STATUS.DONE, Task.STATUS.ARCHIVED];

function text(value, label, max = 255) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new ValidationError(`${label} is required`);
    }
    return value.trim().slice(0, max);
}

function optionalText(value, max = 2000) {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, max) || null;
}

function list(value, label, max) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw new ValidationError(`${label} must be a list`);
    }
    if (value.length > max) {
        throw new ValidationError(`Too many ${label.toLowerCase()}`);
    }
    return value;
}

function sameName(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// "today", "tomorrow", "+3d", "sat" (the next Saturday, today included) or
// "next-week". Anything else means no due date. Never resolves to the past.
function resolveDue(code, timezone) {
    if (!code || typeof code !== 'string') return null;
    const today = moment.tz(timezone).startOf('day');
    let target = null;
    if (code === 'today') target = today;
    else if (code === 'tomorrow') target = today.clone().add(1, 'day');
    else if (code === 'next-week') target = today.clone().add(7, 'day');
    else if (/^\+\d{1,2}d$/.test(code)) {
        target = today.clone().add(Number(code.slice(1, -1)), 'day');
    } else if (WEEKDAYS.includes(code)) {
        const wanted = WEEKDAYS.indexOf(code);
        const diff = (wanted - today.day() + 7) % 7;
        target = today.clone().add(diff, 'day');
    }
    if (!target) return null;
    return processDueDateForStorage(target.format('YYYY-MM-DD'), timezone);
}

function normalizeTask(raw) {
    const tags = list(raw.tags, 'Tags', 5).map((name) => {
        const check = validateTagName(String(name));
        if (!check.valid) throw new ValidationError(check.error);
        return check.name;
    });
    return {
        name: text(raw.name, 'Task name'),
        due: typeof raw.due === 'string' ? raw.due : null,
        tags,
    };
}

function normalizeStarter(body) {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('A starter is required');
    }
    const key = text(body.key, 'Starter', 40);
    if (!STARTER_KEYS.includes(key)) {
        throw new ValidationError('Unknown starter');
    }

    let projectCount = 0;
    let taskCount = 0;
    const areas = list(body.areas, 'Areas', LIMITS.areas).map((raw) => {
        const projects = list(raw.projects, 'Projects', LIMITS.projects).map(
            (project) => {
                projectCount += 1;
                const tasks = list(project.tasks, 'Tasks', LIMITS.tasks).map(
                    normalizeTask
                );
                taskCount += tasks.length;
                return { name: text(project.name, 'Project name'), tasks };
            }
        );
        const tasks = list(raw.tasks, 'Tasks', LIMITS.tasks).map(normalizeTask);
        taskCount += tasks.length;
        const goal =
            raw.goal && typeof raw.goal === 'object'
                ? {
                      title: text(raw.goal.title, 'Goal title'),
                      why: optionalText(raw.goal.why),
                      horizon: raw.goal.horizon === 'year' ? 'year' : 'season',
                  }
                : null;
        return {
            name: text(raw.name, 'Area name'),
            color:
                typeof raw.color === 'string' &&
                /^#[0-9a-fA-F]{6}$/.test(raw.color)
                    ? raw.color
                    : null,
            goal,
            projects,
            tasks,
        };
    });
    if (projectCount > LIMITS.projects) {
        throw new ValidationError('Too many projects');
    }
    if (taskCount > LIMITS.tasks) {
        throw new ValidationError('Too many tasks');
    }

    const habits = list(body.habits, 'Habits', LIMITS.habits).map((raw) => {
        const days = list(raw.days, 'Days', 7);
        if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
            throw new ValidationError('Schedule days must be 0-6');
        }
        return {
            name: text(raw.name, 'Habit name'),
            period: raw.period === 'weekly' ? 'weekly' : 'daily',
            days:
                days.length > 0 && days.length < 7 ? [...new Set(days)] : null,
        };
    });

    const note =
        body.note && typeof body.note === 'object'
            ? {
                  title: text(body.note.title, 'Note title'),
                  content: optionalText(body.note.content, 20000) || '',
                  area: Number.isInteger(body.note.area)
                      ? body.note.area
                      : null,
              }
            : null;

    return { key, areas, habits, note, counts: { projectCount, taskCount } };
}

const onboardingService = {
    // Applies a starter and records the choice. Areas, projects and habits
    // the account already has (by name) are reused rather than duplicated,
    // so the screen is safe for accounts that are not empty. Tasks are
    // always created and marked as examples of the starter.
    async applyStarter(user, body) {
        const starter = normalizeStarter(body);
        const userId = user.id;
        const timezone = getSafeTimezone(user.timezone);

        if (starter.counts.projectCount > 0) {
            await entitlements.assertCanCreate(
                userId,
                'project',
                starter.counts.projectCount
            );
        }
        if (starter.counts.taskCount > 0) {
            await entitlements.assertCanCreate(
                userId,
                'task',
                starter.counts.taskCount
            );
        }
        if (starter.note) {
            await entitlements.assertCanCreate(userId, 'note', 1);
        }

        const created = {
            areas: 0,
            goals: 0,
            projects: 0,
            tasks: 0,
            habits: 0,
            notes: 0,
        };

        await sequelize.transaction(async (transaction) => {
            const existingAreas = await Area.findAll({
                where: { user_id: userId },
                attributes: ['id', 'name'],
                transaction,
            });
            const existingProjects = await Project.findAll({
                where: { user_id: userId },
                attributes: ['id', 'name'],
                transaction,
            });
            const existingHabits = await Task.findAll({
                where: { user_id: userId, habit_mode: true },
                attributes: ['id', 'name'],
                transaction,
            });
            const tagCache = new Map();
            const findTag = async (name) => {
                if (tagCache.has(name)) return tagCache.get(name);
                const [tag] = await Tag.findOrCreate({
                    where: { user_id: userId, name },
                    defaults: { user_id: userId, name },
                    transaction,
                });
                tagCache.set(name, tag);
                return tag;
            };
            const createTask = async (task, areaId, projectId) => {
                const row = await Task.create(
                    {
                        name: task.name,
                        user_id: userId,
                        area_id: areaId,
                        project_id: projectId,
                        due_date: resolveDue(task.due, timezone),
                        status: Task.STATUS.NOT_STARTED,
                        example_of: starter.key,
                    },
                    { transaction }
                );
                if (task.tags.length > 0) {
                    const tags = [];
                    for (const name of task.tags)
                        tags.push(await findTag(name));
                    await row.setTags(tags, { transaction });
                }
                created.tasks += 1;
            };

            const areaRows = [];
            for (const area of starter.areas) {
                let row = existingAreas.find((a) =>
                    sameName(a.name, area.name)
                );
                if (!row) {
                    row = await Area.create(
                        {
                            name: area.name,
                            description: '',
                            color: area.color,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    created.areas += 1;
                }
                areaRows.push(row);

                let goal = null;
                if (area.goal) {
                    goal = await Goal.create(
                        {
                            user_id: userId,
                            area_id: row.id,
                            title: area.goal.title,
                            why: area.goal.why,
                            horizon: area.goal.horizon,
                            status: 'active',
                        },
                        { transaction }
                    );
                    created.goals += 1;
                }

                for (const project of area.projects) {
                    let projectRow = existingProjects.find((p) =>
                        sameName(p.name, project.name)
                    );
                    if (!projectRow) {
                        projectRow = await Project.create(
                            {
                                name: project.name,
                                description: '',
                                area_id: row.id,
                                goal_id: goal ? goal.id : null,
                                status: 'in_progress',
                                user_id: userId,
                            },
                            { transaction }
                        );
                        created.projects += 1;
                    }
                    for (const task of project.tasks) {
                        await createTask(task, row.id, projectRow.id);
                    }
                }
                for (const task of area.tasks) {
                    await createTask(task, row.id, null);
                }
            }

            for (const habit of starter.habits) {
                if (existingHabits.some((h) => sameName(h.name, habit.name))) {
                    continue;
                }
                await Task.create(
                    {
                        name: habit.name,
                        user_id: userId,
                        habit_mode: true,
                        habit_polarity: 'build',
                        habit_target_count: 1,
                        habit_frequency_period: habit.period,
                        habit_schedule_days: habit.days,
                        recurrence_type: 'daily',
                        recurrence_interval: 1,
                        status: Task.STATUS.NOT_STARTED,
                    },
                    { transaction }
                );
                created.habits += 1;
            }

            if (starter.note) {
                const existing = await Note.findOne({
                    where: { user_id: userId, title: starter.note.title },
                    attributes: ['id'],
                    transaction,
                });
                if (!existing) {
                    await Note.create(
                        {
                            title: starter.note.title,
                            content: starter.note.content,
                            user_id: userId,
                        },
                        { transaction }
                    );
                    created.notes += 1;
                }
            }

            const row = await User.findByPk(userId, {
                attributes: ['id', 'onboarded_at', 'onboarding_starter'],
                transaction,
            });
            row.onboarding_starter = starter.key;
            if (!row.onboarded_at) row.onboarded_at = new Date();
            await row.save({
                fields: ['onboarding_starter', 'onboarded_at'],
                transaction,
            });
        });

        const row = await User.findByPk(userId, {
            attributes: ['onboarded_at', 'onboarding_starter'],
        });
        return {
            onboarding_starter: row.onboarding_starter,
            onboarded_at: row.onboarded_at,
            created,
        };
    },

    // Example tasks a starter made that the person has not touched yet.
    async countExamples(user) {
        const count = await Task.count({
            where: {
                user_id: user.id,
                example_of: { [Op.ne]: null },
                status: { [Op.notIn]: DONE_STATUSES },
            },
        });
        return { count };
    },

    async removeExamples(user) {
        const removed = await Task.destroy({
            where: {
                user_id: user.id,
                example_of: { [Op.ne]: null },
                status: { [Op.notIn]: DONE_STATUSES },
            },
        });
        return { removed };
    },
};

module.exports = onboardingService;
module.exports.STARTER_KEYS = STARTER_KEYS;
module.exports.resolveDue = resolveDue;
