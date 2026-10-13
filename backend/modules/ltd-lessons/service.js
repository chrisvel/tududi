'use strict';

// Life-to-Day (T-1102): life lessons (blueprint 14.7, ADR-014). A lesson is
// its own row, linked to a goal, project, area or tag of its owner. Every
// write, a review check included, is a Journal entry with Undo, and only a
// human session deletes. The task effect (T-1101) reads the active lessons.
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { LtdLesson, LtdLessonCheck, Goal, User } = require('../../models');
const repository = require('./repository');
const journal = require('../ltd-journal/service');
const progress = require('../ltd-progress/service');
const { taskEffect } = require('../ltd-progress/effect');
const { isoDay } = require('../ltd-milestones/service');
const { isValidClientUid } = require('../ltd-idempotency');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
} = require('../../shared/errors');

const TEXTS = ['expected', 'happened', 'if_text', 'then_text'];
const STATUSES = ['active', 'parked', 'retired'];
const SOURCE_TYPES = ['free', 'milestone', 'task', 'goal'];
const VERDICTS = ['holds', 'not_yet', 'park'];
const LINK_TYPES = Object.keys(repository.TARGETS);
const MAX_TEXT = 10000;
const MAX_LINKS = 20;
// The weekly-priority pattern: three is enough, a fourth is saved anyway.
const SOFT_CAP = 3;
const REVIEW_DAYS = { create: 14, holds: 14, not_yet: 7 };

const addDays = (day, days) =>
    moment.utc(day, 'YYYY-MM-DD').add(days, 'days').format('YYYY-MM-DD');
async function todayFor(userId) {
    const user = await User.findByPk(userId, { attributes: ['timezone'] });
    return moment.tz(getSafeTimezone(user?.timezone)).format('YYYY-MM-DD');
}
const actorFor = (userId, actor) => ({
    ...actor,
    user_id: userId,
    actor_type: actor?.actor_type || 'user',
});

function validate(data, create = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new ValidationError('Lesson data is required');
    const fields = {};
    for (const field of repository.FIELDS)
        if (data[field] !== undefined) fields[field] = data[field];
    if (create || fields.title !== undefined) {
        if (
            typeof fields.title !== 'string' ||
            !fields.title.trim() ||
            fields.title.length > 255
        )
            throw new ValidationError(
                'Lesson title is required (maximum 255 characters)'
            );
        fields.title = fields.title.trim();
    }
    for (const field of TEXTS) {
        if (fields[field] === undefined) continue;
        if (
            fields[field] !== null &&
            (typeof fields[field] !== 'string' ||
                fields[field].length > MAX_TEXT)
        )
            throw new ValidationError(
                `${field} must be text (maximum ${MAX_TEXT} characters)`
            );
        if (!fields[field]?.trim()) fields[field] = null;
    }
    if (fields.learned_on !== undefined)
        isoDay(fields.learned_on, 'learned_on');
    if (fields.review_on != null) isoDay(fields.review_on, 'review_on');
    if (fields.status !== undefined && !STATUSES.includes(fields.status))
        throw new ValidationError('status must be active, parked or retired');
    if (
        fields.source_type != null &&
        !SOURCE_TYPES.includes(fields.source_type)
    )
        throw new ValidationError(
            'source_type must be free, milestone, task or goal'
        );
    if (
        fields.source_uid != null &&
        (typeof fields.source_uid !== 'string' || !fields.source_uid)
    )
        throw new ValidationError('source_uid must be a UID or null');
    let links;
    if (data.links !== undefined) {
        if (
            !Array.isArray(data.links) ||
            data.links.length > MAX_LINKS ||
            data.links.some(
                (l) =>
                    !l ||
                    !LINK_TYPES.includes(l.type) ||
                    typeof l.uid !== 'string' ||
                    !l.uid
            )
        )
            throw new ValidationError(
                `links must be up to ${MAX_LINKS} { type: goal|project|area|tag, uid }`
            );
        links = data.links.map((l) => ({ type: l.type, uid: l.uid }));
    }
    return { fields, links };
}

// An if without a then, or a then without an if, is refused.
function assertPair(state) {
    if (Boolean(state.if_text) !== Boolean(state.then_text))
        throw new ValidationError('if_text and then_text go together');
}

async function warningFor(userId, lesson, targets, transaction) {
    if (lesson.status !== 'active') return undefined;
    const goals = targets
        .filter((t) => t.target_type === 'goal')
        .map((t) => t.target_id);
    const counts = await repository.activeCountsByGoal(
        userId,
        goals,
        transaction
    );
    return [...counts.values()].some((n) => n > SOFT_CAP)
        ? 'three_is_enough'
        : undefined;
}

function serialize(lesson, linksOf) {
    return {
        uid: lesson.uid,
        title: lesson.title,
        expected: lesson.expected ?? null,
        happened: lesson.happened ?? null,
        if_text: lesson.if_text ?? null,
        then_text: lesson.then_text ?? null,
        learned_on: lesson.learned_on,
        review_on: lesson.review_on ?? null,
        status: lesson.status,
        source_type: lesson.source_type ?? null,
        source_uid: lesson.source_uid ?? null,
        links: linksOf(lesson),
        created_at: lesson.created_at,
        updated_at: lesson.updated_at,
    };
}
async function present(userId, lessons, transaction) {
    const rows = await repository.links(
        lessons.map((l) => l.id),
        transaction
    );
    const linksOf = await repository.describeTargets(userId, rows);
    return lessons.map((lesson) => serialize(lesson, linksOf));
}
const one = async (userId, lesson, transaction) =>
    (await present(userId, [lesson], transaction))[0];
const reply = (lesson, warning) => (warning ? { lesson, warning } : { lesson });

async function list(userId, query = {}) {
    const status = query.status || 'all';
    if (status !== 'all' && !STATUSES.includes(status))
        throw new ValidationError(
            'status must be active, parked, retired or all'
        );
    const where = { user_id: userId };
    if (status !== 'all') where.status = status;
    if (query.goal_uid !== undefined) {
        const goal = await Goal.findOne({
            where: { uid: query.goal_uid, user_id: userId },
            attributes: ['id'],
        });
        if (!goal) throw new NotFoundError('Goal not found');
        const linked = await LtdLesson.findAll({
            where,
            attributes: ['id'],
            include: [
                {
                    association: 'links',
                    where: { target_type: 'goal', target_id: goal.id },
                    attributes: [],
                },
            ],
            raw: true,
        });
        where.id = { [Op.in]: linked.map((l) => l.id) };
    }
    const lessons = await LtdLesson.findAll({
        where,
        order: [
            ['learned_on', 'DESC'],
            ['id', 'DESC'],
        ],
    });
    return present(userId, lessons);
}

async function get(userId, uid) {
    return one(userId, await repository.find(userId, uid));
}

async function create(userId, data, actor) {
    const { fields, links } = validate(data, true);
    if (data.uid !== undefined && !isValidClientUid(data.uid))
        throw new ValidationError('Invalid lesson uid');
    const today = await todayFor(userId);
    fields.learned_on = fields.learned_on || today;
    if (fields.review_on === undefined)
        fields.review_on = addDays(fields.learned_on, REVIEW_DAYS.create);
    fields.status = fields.status || 'active';
    assertPair(fields);
    // An offline create retried after reconnect gets the first lesson back.
    if (data.uid !== undefined) {
        const existing = await LtdLesson.findOne({ where: { uid: data.uid } });
        if (existing) {
            if (existing.user_id !== userId)
                throw new ValidationError('Invalid lesson uid');
            return { lesson: await one(userId, existing), existing: true };
        }
    }
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const targets = await repository.resolveTargets(
                userId,
                links || [],
                transaction
            );
            await repository.assertSource(
                userId,
                fields.source_type,
                fields.source_uid,
                transaction
            );
            const lesson = await LtdLesson.create(
                {
                    ...fields,
                    ...(data.uid !== undefined ? { uid: data.uid } : {}),
                    user_id: userId,
                },
                { transaction }
            );
            await repository.replaceLinks(lesson.id, targets, transaction);
            await record({
                op: 'lesson_create',
                entity_type: 'lesson',
                entity_uid: lesson.uid,
                before: null,
                after: { fields: repository.fieldsOf(lesson), links: targets },
            });
            return reply(
                await one(userId, lesson, transaction),
                await warningFor(userId, lesson, targets, transaction)
            );
        }
    );
}

async function update(userId, uid, data, actor) {
    const { fields, links } = validate(data);
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const lesson = await repository.find(userId, uid, transaction);
            assertPair({ ...repository.fieldsOf(lesson), ...fields });
            const source = { ...repository.fieldsOf(lesson), ...fields };
            if (
                fields.source_type !== undefined ||
                fields.source_uid !== undefined
            )
                await repository.assertSource(
                    userId,
                    source.source_type,
                    source.source_uid,
                    transaction
                );
            const current = repository.sortLinks(
                await repository.links([lesson.id], transaction)
            );
            const targets =
                links === undefined
                    ? current
                    : await repository.resolveTargets(
                          userId,
                          links,
                          transaction
                      );
            const linksChanged =
                JSON.stringify(targets) !== JSON.stringify(current);
            // Nothing to change, nothing to journal.
            if (!Object.keys(fields).length && !linksChanged)
                return reply(await one(userId, lesson, transaction));
            const before = {
                fields: Object.fromEntries(
                    Object.keys(fields).map((key) => [key, lesson[key] ?? null])
                ),
                ...(linksChanged ? { links: current } : {}),
            };
            await lesson.update(fields, { transaction });
            if (linksChanged)
                await repository.replaceLinks(lesson.id, targets, transaction);
            await record({
                op: 'lesson_update',
                entity_type: 'lesson',
                entity_uid: lesson.uid,
                before,
                after: {
                    fields: Object.fromEntries(
                        Object.keys(fields).map((key) => [
                            key,
                            lesson[key] ?? null,
                        ])
                    ),
                    ...(linksChanged ? { links: targets } : {}),
                },
            });
            const recount = linksChanged || fields.status === 'active';
            return reply(
                await one(userId, lesson, transaction),
                recount
                    ? await warningFor(userId, lesson, targets, transaction)
                    : undefined
            );
        }
    );
}

// Only a signed-in human deletes; an API token or MCP gets 403.
async function remove(userId, uid, actor) {
    const effectiveActor = actorFor(userId, actor);
    if (effectiveActor.actor_type !== 'user')
        throw new ForbiddenError('Only a human user can delete a lesson');
    return journal.withJournal(effectiveActor, async (transaction, record) => {
        const lesson = await repository.find(userId, uid, transaction);
        const checks = await LtdLessonCheck.findAll({
            where: { lesson_id: lesson.id },
            order: [['id', 'ASC']],
            transaction,
        });
        const before = {
            fields: repository.fieldsOf(lesson),
            links: repository.sortLinks(
                await repository.links([lesson.id], transaction)
            ),
            checks: checks.map((c) => ({
                uid: c.uid,
                checked_on: c.checked_on,
                verdict: c.verdict,
                note: c.note,
                created_at: c.created_at,
            })),
        };
        await lesson.destroy({ transaction });
        const entry = await record({
            op: 'lesson_delete',
            entity_type: 'lesson',
            entity_uid: lesson.uid,
            before,
            after: null,
        });
        return { journal_uid: entry.uid };
    });
}

// holds: again in 14 days. not_yet: again in 7. park: parked, no date.
async function check(userId, uid, data = {}, actor) {
    if (!VERDICTS.includes(data.verdict))
        throw new ValidationError('verdict must be holds, not_yet or park');
    if (
        data.note != null &&
        (typeof data.note !== 'string' || data.note.length > MAX_TEXT)
    )
        throw new ValidationError(
            `note must be text (maximum ${MAX_TEXT} characters)`
        );
    const day =
        data.date === undefined
            ? await todayFor(userId)
            : isoDay(data.date, 'date');
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const lesson = await repository.find(userId, uid, transaction);
            if (lesson.status !== 'active')
                throw new ConflictError('Only an active lesson is reviewed');
            const changes =
                data.verdict === 'park'
                    ? { status: 'parked', review_on: null }
                    : {
                          status: 'active',
                          review_on: addDays(day, REVIEW_DAYS[data.verdict]),
                      };
            const before = {
                status: lesson.status,
                review_on: lesson.review_on ?? null,
            };
            const created = await LtdLessonCheck.create(
                {
                    lesson_id: lesson.id,
                    checked_on: day,
                    verdict: data.verdict,
                    note: data.note?.trim() || null,
                },
                { transaction }
            );
            await lesson.update(changes, { transaction });
            const entry = await record({
                op: 'lesson_check',
                entity_type: 'lesson',
                entity_uid: lesson.uid,
                before: { fields: before },
                after: { fields: changes, check_uid: created.uid },
            });
            return {
                lesson: await one(userId, lesson, transaction),
                check: {
                    uid: created.uid,
                    checked_on: created.checked_on,
                    verdict: created.verdict,
                    note: created.note,
                },
                journal_uid: entry.uid,
            };
        }
    );
}

// The one review question of the day: the oldest due active lesson, and
// none once a lesson was reviewed that day.
async function due(userId, date) {
    const day =
        date === undefined ? await todayFor(userId) : isoDay(date, 'date');
    const answered = await LtdLessonCheck.count({
        where: { checked_on: day },
        include: [
            {
                model: LtdLesson,
                as: 'Lesson',
                where: { user_id: userId },
                attributes: [],
            },
        ],
    });
    if (answered) return { date: day, lesson: null };
    const lesson = await LtdLesson.findOne({
        where: {
            user_id: userId,
            status: 'active',
            review_on: { [Op.lte]: day },
        },
        order: [
            ['review_on', 'ASC'],
            ['id', 'ASC'],
        ],
    });
    return { date: day, lesson: lesson ? await one(userId, lesson) : null };
}

async function effect(userId, taskUid) {
    if (typeof taskUid !== 'string' || !taskUid)
        throw new ValidationError('task_uid is required');
    const snapshot = await progress.snapshot(userId);
    const task = snapshot.tasks.find((t) => t.uid === taskUid);
    if (!task) throw new NotFoundError('Task not found');
    const [lessons, tagIds] = await Promise.all([
        repository.activeWithLinks(userId),
        repository.taskTagIds(task.id),
    ]);
    // Today for review_on comes from the snapshot user's timezone.
    return taskEffect({ ...task, tag_ids: tagIds }, snapshot, { lessons });
}

module.exports = {
    list,
    get,
    create,
    update,
    remove,
    check,
    due,
    effect,
    validate,
    assertPair,
};
