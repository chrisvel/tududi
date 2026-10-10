'use strict';

const {
    User,
    Area,
    Goal,
    Project,
    Task,
    Tag,
    Person,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const {
    processDueDateForStorage,
    getSafeTimezone,
} = require('../../utils/timezone-utils');
const { verifyToken } = require('./service');

// "Keep it": the signed result becomes rows in the person's account, in one
// transaction. Same-name areas and projects are reused so running it twice,
// or into an account that already has a Home area, does not double things.
// Tasks are the person's real items, not examples, so they carry no
// example_of mark.

const SOMEDAY_TAG = 'someday';

function sameName(a, b) {
    return (
        typeof a === 'string' &&
        typeof b === 'string' &&
        a.trim().toLowerCase() === b.trim().toLowerCase()
    );
}

function countWork(result) {
    let projects = 0;
    let tasks = 0;
    for (const area of result.areas) {
        projects += area.projects.length;
        for (const p of area.projects) tasks += p.tasks.length;
        tasks += area.items.length;
    }
    return { projects, tasks };
}

async function keep(user, body = {}) {
    const result = verifyToken(body.token);
    const userId = user.id;
    const timezone = getSafeTimezone(user.timezone);
    const counts = countWork(result);

    await entitlements.assertCanCreate(userId, 'project', counts.projects);
    await entitlements.assertCanCreate(userId, 'task', counts.tasks);

    const created = {
        areas: 0,
        goals: 0,
        projects: 0,
        tasks: 0,
        habits: 0,
        people: 0,
    };

    await sequelize.transaction(async (transaction) => {
        const existingAreas = await Area.findAll({
            where: { user_id: userId },
            transaction,
        });
        const existingProjects = await Project.findAll({
            where: { user_id: userId },
            transaction,
        });
        const existingHabits = await Task.findAll({
            where: { user_id: userId, habit_mode: true },
            attributes: ['id', 'name'],
            transaction,
        });
        const existingPeople = await Person.findAll({
            where: { user_id: userId },
            transaction,
        });

        let somedayTag = null;
        const findSomedayTag = async () => {
            if (somedayTag) return somedayTag;
            const [tag] = await Tag.findOrCreate({
                where: { user_id: userId, name: SOMEDAY_TAG },
                defaults: { user_id: userId, name: SOMEDAY_TAG },
                transaction,
            });
            somedayTag = tag;
            return tag;
        };

        const findPerson = async (name) => {
            let person = existingPeople.find((p) => sameName(p.name, name));
            if (!person) {
                person = await Person.create(
                    { user_id: userId, name, relationship_type: 'other' },
                    { transaction }
                );
                existingPeople.push(person);
                created.people += 1;
            }
            return person;
        };

        const dueFor = (due) =>
            due ? processDueDateForStorage(due, timezone) : null;

        for (const area of result.areas) {
            let areaRow = existingAreas.find((a) =>
                sameName(a.name, area.name)
            );
            if (!areaRow) {
                areaRow = await Area.create(
                    { name: area.name, description: '', user_id: userId },
                    { transaction }
                );
                existingAreas.push(areaRow);
                created.areas += 1;
            }

            let goalRow = null;
            if (area.goal) {
                const existing = await Goal.findOne({
                    where: { user_id: userId, area_id: areaRow.id },
                    transaction,
                });
                goalRow =
                    existing && sameName(existing.title, area.goal.title)
                        ? existing
                        : await Goal.create(
                              {
                                  user_id: userId,
                                  area_id: areaRow.id,
                                  title: area.goal.title,
                                  why: area.goal.why || null,
                                  horizon: 'season',
                                  status: 'active',
                              },
                              { transaction }
                          );
                if (goalRow !== existing) created.goals += 1;
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
                            area_id: areaRow.id,
                            goal_id: goalRow ? goalRow.id : null,
                            status: 'in_progress',
                            user_id: userId,
                        },
                        { transaction }
                    );
                    existingProjects.push(projectRow);
                    created.projects += 1;
                }
                for (const task of project.tasks) {
                    await Task.create(
                        {
                            name: task.title,
                            user_id: userId,
                            area_id: areaRow.id,
                            project_id: projectRow.id,
                            due_date: dueFor(task.due),
                            estimated_minutes: task.minutes,
                            status: Task.STATUS.NOT_STARTED,
                        },
                        { transaction }
                    );
                    created.tasks += 1;
                }
            }

            for (const item of area.items) {
                if (item.kind === 'habit') {
                    if (existingHabits.find((h) => sameName(h.name, item.title)))
                        continue;
                    await Task.create(
                        {
                            name: item.title,
                            user_id: userId,
                            area_id: areaRow.id,
                            habit_mode: true,
                            habit_polarity: 'build',
                            habit_target_count: item.habit_times || 1,
                            habit_frequency_period:
                                item.habit_period || 'weekly',
                            recurrence_type: 'daily',
                            recurrence_interval: 1,
                            status: Task.STATUS.NOT_STARTED,
                        },
                        { transaction }
                    );
                    created.habits += 1;
                    continue;
                }

                const row = await Task.create(
                    {
                        name: item.title,
                        user_id: userId,
                        area_id: areaRow.id,
                        due_date: dueFor(item.due),
                        estimated_minutes: item.minutes,
                        status:
                            item.kind === 'waiting'
                                ? Task.STATUS.WAITING
                                : Task.STATUS.NOT_STARTED,
                        assigned_to:
                            item.kind === 'waiting' && item.person
                                ? (await findPerson(item.person)).uid
                                : null,
                    },
                    { transaction }
                );
                if (item.kind === 'someday') {
                    await row.setTags([await findSomedayTag()], {
                        transaction,
                    });
                }
                created.tasks += 1;
            }
        }

        const userRow = await User.findByPk(userId, { transaction });
        const changes = {};
        if (!userRow.onboarding_starter) changes.onboarding_starter = 'untangle';
        if (!userRow.onboarded_at) changes.onboarded_at = new Date();
        if (Object.keys(changes).length > 0) {
            await userRow.update(changes, { transaction });
        }
    });

    const fresh = await User.findByPk(userId, {
        attributes: ['onboarding_starter', 'onboarded_at'],
    });
    return {
        onboarding_starter: fresh.onboarding_starter,
        onboarded_at: fresh.onboarded_at,
        created,
    };
}

module.exports = { keep };
