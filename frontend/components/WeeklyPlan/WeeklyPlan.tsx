import { formatDisplayDate, getEffectiveWeekStart } from '../../utils/jalali';
import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    fetchGoalTree,
    flattenGoals,
    planningKeys,
    refreshPlanning,
} from '../../utils/planningService';
import { createGoal } from '../../utils/goalsService';
import { createGoalUrl } from '../../utils/slugUtils';
import GoalProgressBars from '../GoalTree/GoalProgressBars';
const dateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const inputClass =
    'w-full min-w-0 rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900';
const weekStart = () => {
    const date = new Date();
    date.setDate(
        date.getDate() - ((date.getDay() - getEffectiveWeekStart(1) + 7) % 7)
    );
    return dateString(date);
};
export default function WeeklyPlan() {
    const { t } = useTranslation();
    const [start, setStart] = useState(weekStart);
    const end = useMemo(() => {
        const date = new Date(`${start}T12:00:00`);
        date.setDate(date.getDate() + 6);
        return dateString(date);
    }, [start]);
    const { data, error: loadError } = useSWR(planningKeys.tree, fetchGoalTree);
    const goals = flattenGoals(data?.goals || []);
    const priorities = goals.filter(
        (goal) =>
            goal.horizon === 'week' &&
            goal.period_start &&
            goal.period_end &&
            goal.period_start <= end &&
            goal.period_end >= start
    );
    const [title, setTitle] = useState('');
    const [parent, setParent] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <main
            className="mx-auto w-full max-w-5xl space-y-4 p-4"
            data-testid="weekly-plan"
        >
            <h1 className="text-2xl font-medium">
                {t('ltdPlanning.weeklyPlan')}
            </h1>
            <Link
                to="/today/plan"
                className="inline-block rounded border px-3 py-2 text-sm"
            >
                {t('navigation.ltd.plan', 'Plan')}
            </Link>
            <label className="block">
                {t('ltdPlanning.weekOf')}
                <input
                    type="date"
                    required
                    className={inputClass}
                    value={start}
                    onChange={(e) => {
                        if (e.target.value) setStart(e.target.value);
                    }}
                />
            </label>
            <p className="text-sm text-gray-500">{t('ltdPlanning.weekHint')}</p>
            {priorities.length > 3 && (
                <p role="status" className="text-amber-700 dark:text-amber-300">
                    {t('ltdPlanning.threeEnough')}
                </p>
            )}
            {(error || loadError) && (
                <p role="alert">{error || loadError.message}</p>
            )}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {priorities.map((goal) => (
                    <li
                        className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                        key={goal.uid}
                    >
                        <Link
                            className="break-words font-medium"
                            to={createGoalUrl({
                                uid: goal.uid!,
                                title: goal.title,
                            })}
                        >
                            <bdi>{goal.title}</bdi>
                        </Link>
                        <GoalProgressBars progress={goal.progress} />
                    </li>
                ))}
            </ul>
            <form
                className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    try {
                        await createGoal({
                            title,
                            horizon: 'week',
                            status: 'active',
                            parent_goal_id: parent ? Number(parent) : null,
                            period_start: start,
                            period_end: end,
                        });
                        setTitle('');
                        await refreshPlanning();
                    } catch (err) {
                        setError((err as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label>
                    {t('ltdPlanning.priorityTitle')}
                    <input
                        required
                        className={inputClass}
                        aria-label={t('ltdPlanning.priorityTitle')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </label>
                <label>
                    {t('ltdPlanning.parent')}
                    <select
                        aria-label={t('ltdPlanning.priorityParent')}
                        className={inputClass}
                        value={parent}
                        onChange={(e) => setParent(e.target.value)}
                    >
                        <option value="">{t('ltdPlanning.noParent')}</option>
                        {goals
                            .filter((goal) => goal.horizon !== 'week')
                            .map((goal) => (
                                <option value={goal.id} key={goal.uid}>
                                    {goal.title}
                                </option>
                            ))}
                    </select>
                </label>
                <button
                    disabled={busy}
                    type="submit"
                    className="rounded border px-3 py-2"
                >
                    {t('ltdPlanning.addPriority')}
                </button>
            </form>
            <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-7"
                aria-label={t('ltdPlanning.weekOverview')}
            >
                {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(`${start}T12:00:00`);
                    date.setDate(date.getDate() + i);
                    return (
                        <div
                            key={i}
                            className="min-w-0 rounded border border-gray-200 p-2 text-sm dark:border-gray-700"
                        >
                            <time dateTime={dateString(date)}>
                                {formatDisplayDate(date, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </time>
                            <Link
                                className="mt-2 block text-blue-600"
                                to={`/today/plan?date=${dateString(date)}`}
                            >
                                {t('ltdPlanning.openDay')}
                            </Link>
                        </div>
                    );
                })}
            </div>
        </main>
    );
}
