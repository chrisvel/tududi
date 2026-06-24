import React, { useEffect, useState } from 'react';
import { Task } from '../../entities/Task';
import {
    CheckCircleIcon,
    FireIcon,
    TrophyIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { fetchHabitCompletions } from '../../utils/habitsService';

interface HabitCardProps {
    habit: Task;
    onComplete: (uid: string) => void;
    onEdit: (habit: Task) => void;
}

function toLocalDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAYS = 30;

const last30Days = (): { key: string; date: Date }[] => {
    const today = new Date();
    return Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (DAYS - 1 - i));
        return { key: toLocalDateKey(d), date: d };
    });
};

const HabitCard: React.FC<HabitCardProps> = ({ habit, onComplete, onEdit }) => {
    const { t } = useTranslation();

    const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
    const [loadingDots, setLoadingDots] = useState(true);

    useEffect(() => {
        if (!habit.uid) return;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (DAYS - 1));
        start.setHours(0, 0, 0, 0);

        fetchHabitCompletions(habit.uid, start, end)
            .then((completions) => {
                const keys = new Set(
                    completions
                        .filter((c) => !c.skipped)
                        .map((c) => toLocalDateKey(new Date(c.completed_at)))
                );
                setCompletedDays(keys);
            })
            .catch(() => {})
            .finally(() => setLoadingDots(false));
    }, [habit.uid]);

    const days = last30Days();

    const isCompletedToday = (() => {
        if (!habit.habit_last_completion_at) return false;
        const last = new Date(habit.habit_last_completion_at);
        const today = new Date();
        return (
            last.getFullYear() === today.getFullYear() &&
            last.getMonth() === today.getMonth() &&
            last.getDate() === today.getDate()
        );
    })();

    const frequencyLabel =
        habit.habit_target_count && habit.habit_frequency_period
            ? `${habit.habit_target_count}× per ${habit.habit_frequency_period}`
            : null;

    const stats = [
        {
            icon: <FireIcon className="h-3.5 w-3.5" />,
            count: habit.habit_current_streak ?? 0,
            label: t('habits.stats.streak', 'streak'),
        },
        {
            icon: <TrophyIcon className="h-3.5 w-3.5" />,
            count: habit.habit_best_streak ?? 0,
            label: t('habits.stats.best', 'best'),
        },
        {
            icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
            count: habit.habit_total_completions ?? 0,
            label: t('habits.stats.done', 'done'),
        },
    ];

    const todayKey = toLocalDateKey(new Date());

    return (
        <div
            className={`rounded-xl shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-shadow border ${
                isCompletedToday
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
            }`}
            onClick={() => onEdit(habit)}
        >
            {/* Name + complete button */}
            <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3
                        className={`text-sm font-semibold tracking-wide leading-snug ${
                            isCompletedToday
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-gray-800 dark:text-gray-100'
                        }`}
                    >
                        {habit.name}
                    </h3>
                    {frequencyLabel && (
                        <p
                            className={`text-xs mt-1.5 ${
                                isCompletedToday
                                    ? 'text-green-600/70 dark:text-green-400/60'
                                    : 'text-gray-400 dark:text-gray-500'
                            }`}
                        >
                            {frequencyLabel}
                        </p>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isCompletedToday) onComplete(habit.uid!);
                    }}
                    className={`shrink-0 p-1 rounded-full transition-colors ${
                        isCompletedToday
                            ? 'text-green-500 dark:text-green-400 cursor-default'
                            : 'text-gray-300 dark:text-gray-600 hover:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950'
                    }`}
                    title={
                        isCompletedToday
                            ? t('habits.completedToday', 'Completed today')
                            : t('habits.complete', 'Complete habit')
                    }
                >
                    {isCompletedToday ? (
                        <CheckCircleSolid className="w-6 h-6" />
                    ) : (
                        <CheckCircleIcon className="w-6 h-6" />
                    )}
                </button>
            </div>

            {/* 30-day completion diagram */}
            <div className="px-5 pb-4">
                <div
                    className="grid gap-[3px]"
                    style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}
                >
                    {days.map(({ key, date }) => {
                        const done = completedDays.has(key);
                        const isToday = key === todayKey;
                        return (
                            <div
                                key={key}
                                title={date.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                                className={`aspect-square rounded-[2px] transition-colors ${
                                    loadingDots
                                        ? 'bg-gray-100 dark:bg-gray-700 animate-pulse'
                                        : done
                                          ? isCompletedToday && isToday
                                              ? 'bg-green-500 dark:bg-green-400'
                                              : 'bg-green-400 dark:bg-green-500'
                                          : isToday
                                            ? 'bg-gray-200 dark:bg-gray-600 ring-1 ring-gray-400 dark:ring-gray-500'
                                            : 'bg-gray-100 dark:bg-gray-700'
                                }`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Stats footer */}
            <div
                className={`mt-auto rounded-b-xl flex items-stretch divide-x ${
                    isCompletedToday
                        ? 'bg-green-100/70 dark:bg-green-900/40 border-t border-green-200 dark:border-green-800 divide-green-200 dark:divide-green-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600'
                }`}
            >
                {stats.map(({ icon, count, label }) => (
                    <div
                        key={label}
                        className="flex-1 flex flex-col items-center py-3 gap-1"
                    >
                        <span
                            className={`text-base font-semibold leading-none ${
                                isCompletedToday
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-gray-700 dark:text-gray-200'
                            }`}
                        >
                            {count}
                        </span>
                        <span
                            className={`flex items-center gap-1 text-[10px] leading-none ${
                                isCompletedToday
                                    ? 'text-green-600/60 dark:text-green-400/60'
                                    : 'text-gray-400 dark:text-gray-500'
                            }`}
                        >
                            {icon}
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HabitCard;
