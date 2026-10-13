'use strict';

// Life-to-Day (T-1102): data access for lessons, their links and checks, and
// how a Journal entry of a lesson is undone.
const { Op } = require('sequelize');
const {
    LtdLesson,
    LtdLessonLink,
    LtdLessonCheck,
    Goal,
    Project,
    Area,
    Tag,
    Task,
    LtdMilestone,
    sequelize,
} = require('../../models');
const {
    NotFoundError,
    ConflictError,
    ValidationError,
} = require('../../shared/errors');

const FIELDS = [
    'title',
    'expected',
    'happened',
    'if_text',
    'then_text',
    'learned_on',
    'review_on',
    'status',
    'source_type',
    'source_uid',
];
// Each link type, the model its target lives in and the field shown as title.
const TARGETS = {
    goal: { model: Goal, label: 'title' },
    project: { model: Project, label: 'name' },
    area: { model: Area, label: 'name' },
    tag: { model: Tag, label: 'name' },
};
const SOURCES = { milestone: LtdMilestone, task: Task, goal: Goal };

const decode = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
const sortLinks = (links) =>
    links
        .map((l) => ({ target_type: l.target_type, target_id: l.target_id }))
        .sort(
            (a, b) =>
                a.target_type.localeCompare(b.target_type) ||
                a.target_id - b.target_id
        );

// The columns the Journal keeps, so Undo can put a lesson back as it was.
const fieldsOf = (lesson) =>
    Object.fromEntries(FIELDS.map((key) => [key, lesson[key] ?? null]));

async function find(userId, uid, transaction) {
    const lesson = await LtdLesson.findOne({
        where: { uid, user_id: userId },
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!lesson) throw new NotFoundError('Lesson not found');
    return lesson;
}

const links = (lessonIds, transaction) =>
    lessonIds.length
        ? LtdLessonLink.findAll({
              where: { lesson_id: { [Op.in]: lessonIds } },
              order: [['id', 'ASC']],
              raw: true,
              transaction,
          })
        : [];

// [{ type, uid }] → [{ target_type, target_id }]. A target of another user
// is the same as a missing one: 404 and nothing is saved.
async function resolveTargets(userId, requested, transaction) {
    const result = [];
    for (const [type, { model }] of Object.entries(TARGETS)) {
        const uids = [
            ...new Set(
                requested.filter((l) => l.type === type).map((l) => l.uid)
            ),
        ];
        if (!uids.length) continue;
        const rows = await model.findAll({
            where: { uid: { [Op.in]: uids }, user_id: userId },
            attributes: ['id', 'uid'],
            transaction,
        });
        if (rows.length !== uids.length)
            throw new NotFoundError(`Linked ${type} not found`);
        for (const row of rows)
            result.push({ target_type: type, target_id: row.id });
    }
    return sortLinks(result);
}

// Links whose target is gone (or no longer the owner's) are left out.
async function describeTargets(userId, rows) {
    const byType = new Map();
    for (const type of Object.keys(TARGETS)) {
        const ids = rows
            .filter((l) => l.target_type === type)
            .map((l) => l.target_id);
        if (!ids.length) continue;
        const { model, label } = TARGETS[type];
        const found = await model.findAll({
            where: { id: { [Op.in]: [...new Set(ids)] }, user_id: userId },
            attributes: ['id', 'uid', label],
            raw: true,
        });
        byType.set(type, new Map(found.map((r) => [r.id, r])));
    }
    return (lesson) =>
        rows
            .filter((l) => l.lesson_id === lesson.id)
            .map((l) => {
                const target = byType.get(l.target_type)?.get(l.target_id);
                return target
                    ? {
                          type: l.target_type,
                          uid: target.uid,
                          title: target[TARGETS[l.target_type].label],
                      }
                    : null;
            })
            .filter(Boolean);
}

async function replaceLinks(lessonId, targets, transaction) {
    await LtdLessonLink.destroy({
        where: { lesson_id: lessonId },
        transaction,
    });
    if (targets.length)
        await LtdLessonLink.bulkCreate(
            targets.map((t) => ({ ...t, lesson_id: lessonId })),
            { transaction }
        );
}

async function assertSource(userId, type, uid, transaction) {
    if (uid == null) return;
    const model = SOURCES[type];
    if (!model)
        throw new ValidationError(
            'source_uid needs source_type milestone, task or goal'
        );
    const row = await model.findOne({
        where: { uid, user_id: userId },
        attributes: ['id'],
        transaction,
    });
    if (!row) throw new NotFoundError(`Source ${type} not found`);
}

// Active lessons of the user linked to each of these goals, this one included.
async function activeCountsByGoal(userId, goalIds, transaction) {
    if (!goalIds.length) return new Map();
    const rows = await LtdLessonLink.findAll({
        where: { target_type: 'goal', target_id: { [Op.in]: goalIds } },
        include: [
            {
                model: LtdLesson,
                as: 'Lesson',
                where: { user_id: userId, status: 'active' },
                attributes: [],
            },
        ],
        attributes: ['target_id'],
        raw: true,
        transaction,
    });
    const counts = new Map();
    for (const row of rows)
        counts.set(row.target_id, (counts.get(row.target_id) || 0) + 1);
    return counts;
}

// Lessons as taskEffect reads them: active, with their raw links.
async function activeWithLinks(userId) {
    const lessons = await LtdLesson.findAll({
        where: { user_id: userId, status: 'active' },
        raw: true,
    });
    const rows = await links(lessons.map((l) => l.id));
    return lessons.map((lesson) => ({
        ...lesson,
        links: rows.filter((l) => l.lesson_id === lesson.id),
    }));
}

async function taskTagIds(taskId) {
    const [rows] = await sequelize.query(
        'SELECT tag_id FROM tasks_tags WHERE task_id = :taskId',
        { replacements: { taskId } }
    );
    return rows.map((row) => row.tag_id);
}

// Journal Undo for entity_type 'lesson'. Each op refuses when the lesson
// changed after it, so a newer edit has to be undone first.
async function restore(entry, userId, transaction, assertUnchanged) {
    const before = decode(entry.before);
    const after = decode(entry.after);
    const current = await LtdLesson.findOne({
        where: { uid: entry.entity_uid, user_id: userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    if (entry.op === 'lesson_delete') {
        if (current) throw new ConflictError('Lesson already exists');
        const lesson = await LtdLesson.create(
            { ...before.fields, uid: entry.entity_uid, user_id: userId },
            { transaction }
        );
        // A target deleted since then is not linked again.
        const kept = [];
        for (const link of before.links || []) {
            const { model } = TARGETS[link.target_type] || {};
            if (
                model &&
                (await model.findOne({
                    where: { id: link.target_id, user_id: userId },
                    attributes: ['id'],
                    transaction,
                }))
            )
                kept.push(link);
        }
        await replaceLinks(lesson.id, kept, transaction);
        if (before.checks?.length)
            await LtdLessonCheck.bulkCreate(
                before.checks.map((check) => ({
                    ...check,
                    lesson_id: lesson.id,
                })),
                { transaction }
            );
        return;
    }
    if (!current) throw new NotFoundError('Lesson not found');
    const sameLinks = async (expected) => {
        const now = sortLinks(await links([current.id], transaction));
        if (JSON.stringify(now) !== JSON.stringify(sortLinks(expected)))
            throw new ConflictError(
                'This item changed after the operation; undo newer changes first'
            );
    };
    if (entry.op === 'lesson_create') {
        assertUnchanged(current, after.fields);
        await sameLinks(after.links || []);
        if (
            await LtdLessonCheck.count({
                where: { lesson_id: current.id },
                transaction,
            })
        )
            throw new ConflictError('Undo this lesson’s reviews first');
        await current.destroy({ transaction });
        return;
    }
    if (entry.op === 'lesson_update') {
        assertUnchanged(current, after.fields);
        if (after.links) await sameLinks(after.links);
        await current.update(before.fields, { transaction });
        if (before.links)
            await replaceLinks(current.id, before.links, transaction);
        return;
    }
    if (entry.op === 'lesson_check') {
        assertUnchanged(current, after.fields);
        const latest = await LtdLessonCheck.findOne({
            where: { lesson_id: current.id },
            order: [['id', 'DESC']],
            transaction,
        });
        if (!latest || latest.uid !== after.check_uid)
            throw new ConflictError('Undo newer reviews first');
        await latest.destroy({ transaction });
        await current.update(before.fields, { transaction });
        return;
    }
    throw new ConflictError('This lesson operation cannot be undone');
}

module.exports = {
    FIELDS,
    TARGETS,
    fieldsOf,
    sortLinks,
    find,
    links,
    resolveTargets,
    describeTargets,
    replaceLinks,
    assertSource,
    activeCountsByGoal,
    activeWithLinks,
    taskTagIds,
    restore,
};
