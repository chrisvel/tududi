'use strict';

// Life-to-Day (T-1101): the effect of one task on the long path (blueprint
// 14.7, ADR-014). A pure read model built from the whyChain and the existing
// outcome O; nothing here is stored and no new number is made. Finishing a
// task can move A, never O: O only moves with a metric check-in.
const { project } = require('./projection');
const habit = require('../habits/habitEngine');

// Link scores: the task's own goal, then the rest of its chain, its project,
// its area, a shared tag. The highest link of a lesson is its score.
const SCORE = { direct: 4, chain: 3, project: 2, area: 1, tag: 1 };

const text = (node) =>
    typeof node?.why === 'string' && node.why.trim() ? node.why : null;

function lessonScore(lesson, task, taskProject, directGoalId, chainIds) {
    let best = 0;
    const areas = new Set(
        [task.area_id, taskProject?.area_id].filter((id) => id != null)
    );
    const tags = new Set(task.tag_ids || []);
    for (const link of lesson.links || []) {
        const id = link.target_id;
        const score =
            link.target_type === 'goal'
                ? id === directGoalId
                    ? SCORE.direct
                    : chainIds.has(id)
                      ? SCORE.chain
                      : 0
                : link.target_type === 'project'
                  ? id === task.project_id
                      ? SCORE.project
                      : 0
                  : link.target_type === 'area'
                    ? areas.has(id)
                        ? SCORE.area
                        : 0
                    : link.target_type === 'tag' && tags.has(id)
                      ? SCORE.tag
                      : 0;
        if (score > best) best = score;
    }
    return best;
}

// At most one lesson: highest score, then one due for review, then the most
// recently updated. A lesson with no matching link never reaches a task.
function pickLesson(lessons, task, taskProject, directGoalId, chainIds, ctx) {
    const ranked = [];
    for (const lesson of lessons) {
        if (lesson.status !== 'active' || lesson.user_id !== ctx.userId)
            continue;
        const score = lessonScore(
            lesson,
            task,
            taskProject,
            directGoalId,
            chainIds
        );
        if (score > 0)
            ranked.push({
                lesson,
                score,
                due: Boolean(lesson.review_on && lesson.review_on <= ctx.today),
                updated: new Date(lesson.updated_at).getTime() || 0,
            });
    }
    ranked.sort(
        (a, b) =>
            b.score - a.score ||
            Number(b.due) - Number(a.due) ||
            b.updated - a.updated ||
            String(a.lesson.uid).localeCompare(String(b.lesson.uid))
    );
    const best = ranked[0]?.lesson;
    return best
        ? {
              uid: best.uid,
              title: best.title,
              if_text: best.if_text ?? null,
              then_text: best.then_text ?? null,
              review_on: best.review_on ?? null,
          }
        : null;
}

/**
 * @param task a snapshot task row, optionally with `tag_ids`
 * @param snapshot the ltd-progress snapshot of the task's owner
 * @param options.lessons the owner's lessons with `links` ({target_type, target_id})
 * @param options.now the moment progress is read at
 * @param options.today the owner's local day (YYYY-MM-DD) for review_on
 */
function taskEffect(task, snapshot, options = {}) {
    const now = options.now || new Date();
    const view = project(snapshot, now);
    const taskProject = view.projectById.get(task.project_id);
    const directGoalId = task.goal_id ?? taskProject?.goal_id ?? null;
    const chain = view.chain(directGoalId);
    // chain() follows parent_goal_id from the direct goal; the ids follow it too.
    const ids = [];
    for (
        let id = directGoalId, seen = new Set();
        view.goalById.has(id) && !seen.has(id);
        id = view.goalById.get(id).parent_goal_id
    ) {
        seen.add(id);
        ids.push(id);
    }
    const fiveYear = chain.find((n) => n.horizon === 'five_year') || null;
    const vision = chain.find((n) => n.horizon === 'vision') || null;
    const outcomeIndex = ids.findIndex(
        (id) => view.progress.get(id)?.O != null
    );
    const outcome =
        outcomeIndex === -1
            ? null
            : {
                  goal_uid: chain[outcomeIndex].uid,
                  title: chain[outcomeIndex].title,
                  horizon: chain[outcomeIndex].horizon,
                  value: view.progress.get(ids[outcomeIndex]).O,
              };
    const activityGoal = outcomeIndex === -1 ? ids[0] : ids[outcomeIndex];
    const today =
        options.today || habit.toDayKey(now, snapshot.user?.timezone || 'UTC');
    return {
        task_uid: task.uid,
        kind: chain.length ? 'linked' : 'unlinked',
        chain,
        fiveYear,
        vision,
        meaning: text(fiveYear) ?? text(vision) ?? text(chain[0]) ?? null,
        outcome,
        activity:
            activityGoal === undefined
                ? false
                : view.activity(task, activityGoal),
        lesson: pickLesson(
            options.lessons || [],
            task,
            taskProject,
            directGoalId,
            new Set(ids),
            { userId: task.user_id, today }
        ),
    };
}

module.exports = { taskEffect, SCORE };
