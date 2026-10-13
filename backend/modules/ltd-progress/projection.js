'use strict';
const {
    utcToUserDateString,
    dateStringToUTC,
} = require('../../utils/timezone-utils');
const habit = require('../habits/habitEngine');
const DAY = 86400000;
const clamp = (value) => Math.min(1, Math.max(0, value));
const weight = (task) => task.estimated_minutes ?? 30;
const inside = (date, goal) =>
    Boolean(
        date &&
        (!goal.period_start || date >= goal.period_start) &&
        (!goal.period_end || date <= goal.period_end)
    );

function metricOutcome(metric) {
    if (metric.current_value == null) return null;
    const difference = Number(metric.target) - Number(metric.baseline);
    if (!difference) return null;
    const value =
        (Number(metric.current_value) - Number(metric.baseline)) / difference;
    return Number.isFinite(value) ? clamp(value) : null;
}
function weightedOutcome(metrics) {
    let sum = 0,
        denominator = 0;
    for (const metric of metrics) {
        const value = metricOutcome(metric);
        const w = Number(metric.weight ?? 1);
        if (value === null || !Number.isFinite(w) || w <= 0) continue;
        sum += value * w;
        denominator += w;
    }
    return {
        value: denominator ? sum / denominator : null,
        weight: denominator,
    };
}
function habitActivity(task, entries, goal, user, now) {
    // A habit contributes duration * expected periods, independently of tasks.
    if (!goal.period_start || !goal.period_end) return { done: 0, total: 0 };
    if ([3, 5].includes(task.status)) return { done: 0, total: 0 };
    if (typeof task.habit_schedule_days === 'string')
        task = {
            ...task,
            habit_schedule_days: JSON.parse(task.habit_schedule_days),
        };
    const cfg = habit.normalizeConfig(task, {
        timezone: user.timezone,
        firstDayOfWeek: user.first_day_of_week,
    });
    const start =
        goal.period_start > cfg.anchorKey ? goal.period_start : cfg.anchorKey;
    const buckets = new Map();
    for (let day = start; day <= goal.period_end; day = habit.addDays(day, 1)) {
        if (habit.isScheduledDay(day, cfg))
            buckets.set(habit.periodStart(day, cfg), {
                amount: 0,
                days: new Set(),
                skipped: false,
            });
    }
    for (const entry of entries) {
        const day = habit.toDayKey(entry.completed_at, cfg.timezone);
        if (
            !inside(day, goal) ||
            day < start ||
            !habit.isScheduledDay(day, cfg)
        )
            continue;
        const bucket = buckets.get(habit.periodStart(day, cfg));
        if (!bucket) continue;
        if (entry.skipped) bucket.skipped = true;
        else if (cfg.measurable)
            bucket.amount += Math.max(0, Number(entry.value) || 0);
        else if (habit.allowsMultiplePerDay(cfg) || !bucket.days.has(day)) {
            bucket.amount += 1;
            bucket.days.add(day);
        }
    }
    let successful = 0,
        expected = 0;
    const today = habit.toDayKey(now, cfg.timezone);
    for (const [startKey, bucket] of buckets) {
        if (bucket.skipped && bucket.amount < cfg.goal) continue;
        expected++;
        if (
            cfg.polarity === 'quit'
                ? habit.periodEnd(startKey, cfg) < today && !bucket.amount
                : bucket.amount >= cfg.goal
        )
            successful++;
    }
    return { done: successful * weight(task), total: expected * weight(task) };
}

function project(snapshot, now = new Date()) {
    const {
        goals,
        tasks,
        projects,
        metrics,
        plans,
        planItems,
        completions,
        user,
    } = snapshot;
    const goalById = new Map(goals.map((g) => [g.id, g]));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const children = new Map(goals.map((g) => [g.id, []]));
    for (const goal of goals)
        if (children.has(goal.parent_goal_id))
            children.get(goal.parent_goal_id).push(goal.id);
    const scheduled = new Map();
    const planById = new Map(plans.map((p) => [p.id, p.plan_date]));
    for (const item of planItems) {
        if (!scheduled.has(item.task_id)) scheduled.set(item.task_id, []);
        scheduled.get(item.task_id).push(planById.get(item.daily_plan_id));
    }
    function descendants(id, seen = new Set()) {
        if (seen.has(id)) return seen;
        seen.add(id);
        for (const child of children.get(id) || []) descendants(child, seen);
        return seen;
    }
    function chain(goalId) {
        const result = [],
            seen = new Set();
        while (goalById.has(goalId) && !seen.has(goalId)) {
            seen.add(goalId);
            const goal = goalById.get(goalId);
            result.push({
                uid: goal.uid,
                title: goal.title,
                horizon: goal.horizon,
                why: goal.why,
            });
            goalId = goal.parent_goal_id;
        }
        return result;
    }
    const outcomes = new Map();
    function outcome(id, seen = new Set()) {
        if (outcomes.has(id)) return outcomes.get(id);
        if (seen.has(id)) return { value: null, weight: 0 };
        const next = new Set(seen).add(id);
        const own = metrics.filter((m) => m.goal_id === id);
        const result = own.length
            ? weightedOutcome(own)
            : weightedOutcome(
                  (children.get(id) || []).map((child) => {
                      const o = outcome(child, next);
                      return {
                          baseline: 0,
                          target: 1,
                          current_value: o.value,
                          weight: o.weight,
                      };
                  })
              );
        outcomes.set(id, result);
        return result;
    }
    // W(g): a non-habit task due or planned inside the goal's period.
    const inWindow = (task, goal) =>
        inside(
            utcToUserDateString(task.due_date, user?.timezone || 'UTC'),
            goal
        ) || (scheduled.get(task.id) || []).some((date) => inside(date, goal));
    // T-1101: whether finishing this task can move A of the goal (W, or the
    // habit part of A). It never says anything about O.
    function activity(task, goalId) {
        const goal = goalById.get(goalId);
        if (!goal) return false;
        const ids = descendants(goalId);
        if (
            !ids.has(task.goal_id) &&
            !ids.has(projectById.get(task.project_id)?.goal_id)
        )
            return false;
        return task.habit_mode
            ? Boolean(goal.period_start && goal.period_end)
            : inWindow(task, goal);
    }
    const result = new Map();
    for (const goal of goals) {
        const ids = descendants(goal.id);
        // A set of task ids implicitly deduplicates direct and project links.
        const linked = tasks.filter(
            (task) =>
                ids.has(task.goal_id) ||
                ids.has(projectById.get(task.project_id)?.goal_id)
        );
        let done = 0,
            total = 0;
        for (const task of linked) {
            if (task.habit_mode) {
                const activity = habitActivity(
                    task,
                    completions.filter((e) => e.task_id === task.id),
                    goal,
                    user || {},
                    now
                );
                done += activity.done;
                total += activity.total;
            } else if (inWindow(task, goal)) {
                total += weight(task);
                if (task.status === 2 || task.status === 'done')
                    done += weight(task);
            }
        }
        const A = total > 0 ? done / total : null;
        const O = outcome(goal.id).value;
        const timezone = user?.timezone || 'UTC';
        const start = goal.period_start
            ? dateStringToUTC(goal.period_start, timezone).getTime()
            : null;
        const end = goal.period_end
            ? dateStringToUTC(goal.period_end, timezone, 'end').getTime()
            : null;
        const expected =
            start !== null && end !== null
                ? end <= start
                    ? now.getTime() >= start
                        ? 1
                        : 0
                    : clamp((now.getTime() - start) / (end - start))
                : null;
        const signal = O ?? A;
        const cutoff = now.getTime() - 7 * DAY;
        const recent =
            linked.some(
                (t) =>
                    t.completed_at &&
                    Date.parse(t.completed_at) >= cutoff &&
                    Date.parse(t.completed_at) <= now.getTime()
            ) ||
            completions.some(
                (e) =>
                    !e.skipped &&
                    linked.some((t) => t.id === e.task_id) &&
                    Date.parse(e.completed_at) >= cutoff &&
                    Date.parse(e.completed_at) <= now.getTime()
            );
        const health =
            goal.status === 'active' && !recent
                ? 'stalled'
                : signal !== null && expected !== null
                  ? signal >= expected - 0.15
                      ? 'on_track'
                      : 'needs_love'
                  : null;
        result.set(goal.id, {
            A,
            O,
            expected,
            health,
            achievement_suggested:
                (O >= 1 && O !== null) ||
                Boolean(
                    goal.period_end &&
                    habit.toDayKey(now, user?.timezone || 'UTC') >
                        goal.period_end
                ),
            whyChain: chain(goal.id),
        });
    }
    return { progress: result, chain, activity, goalById, projectById };
}
module.exports = { metricOutcome, weightedOutcome, habitActivity, project };
