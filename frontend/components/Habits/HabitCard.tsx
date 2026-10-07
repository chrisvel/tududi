import React, { useEffect, useMemo, useState } from 'react';
import { Task } from '../../entities/Task';
import {
    FireIcon,
    TrophyIcon,
    BoltIcon,
    BellIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
    fetchHabitCompletions,
    HabitCompletion,
} from '../../utils/habitsService';
import {
    dayFraction,
    formatHabitTarget,
    habitAccentStyle,
    isHabitCompletedInPeriod,
    isQuitHabit,
    isScheduledOn,
    periodNoun,
    toDayKey,
    totalsByDay,
} from '../../utils/habitUtils';
import HabitCheckIn from './HabitCheckIn';
import { ACCENT, SURFACE } from '../../constants/colorPalette';
import HabitProgressBar from './HabitProgressBar';

interface HabitCardProps {
    habit: Task;
    onCheckIn: (habit: Task, options?: { value?: number }) => Promise<void>;
    onOpen: (habit: Task) => void;
}

const DAYS = 30;

const lastDays = (): Date[] => {
    const today = new Date();
    return Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (DAYS - 1 - i));
        return d;
    });
};

const HabitCard: React.FC<HabitCardProps> = ({ habit, onCheckIn, onOpen }) => {
    const { t } = useTranslation();
    const [completions, setCompletions] = useState<HabitCompletion[]>([]);
    const [loadingDots, setLoadingDots] = useState(true);
    const quit = isQuitHabit(habit);

    // Reload the strip whenever the server-side counters move.
    const version = `${habit.habit_total_completions}-${habit.habit_last_completion_at}-${habit.habit_progress?.skipped}`;
    useEffect(() => {
        if (!habit.uid) return;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (DAYS - 1));
        start.setHours(0, 0, 0, 0);
        fetchHabitCompletions(habit.uid, start, end)
            .then(setCompletions)
            .catch(() => {})
            .finally(() => setLoadingDots(false));
    }, [habit.uid, version]);

    const totals = useMemo(
        () => totalsByDay(habit, completions),
        [habit, completions]
    );
    const days = lastDays();
    const todayKey = toDayKey(new Date());
    const createdKey = habit.created_at
        ? toDayKey(new Date(habit.created_at))
        : '';
    const done = isHabitCompletedInPeriod(habit);
    const streak = habit.habit_current_streak ?? 0;
    const best = habit.habit_best_streak ?? 0;

    const dotClass = (date: Date) => {
        const key = toDayKey(date);
        const dayTotals = totals.get(key);
        if (loadingDots) return 'bg-gray-100 dark:bg-gray-700 animate-pulse';
        if (quit) {
            if (dayTotals && dayTotals.checkIns > 0) {
                return 'bg-red-400 dark:bg-red-500';
            }
            return key >= createdKey
                ? ACCENT.bg
                : 'bg-gray-100 dark:bg-gray-600/50';
        }
        if (dayTotals?.skipped && dayTotals.checkIns === 0) {
            return 'bg-sky-200 dark:bg-sky-800';
        }
        if (!isScheduledOn(habit, date)) {
            return 'bg-gray-50 dark:bg-gray-800';
        }
        return dayFraction(habit, dayTotals) > 0
            ? ACCENT.bg
            : 'bg-gray-100 dark:bg-gray-600/50';
    };

    const dotOpacity = (date: Date) => {
        if (loadingDots) return 1;
        if (quit) {
            const slipped = (totals.get(toDayKey(date))?.checkIns ?? 0) > 0;
            return slipped || toDayKey(date) < createdKey ? 1 : 0.55;
        }
        const fraction = dayFraction(habit, totals.get(toDayKey(date)));
        return fraction > 0 ? 0.35 + fraction * 0.65 : 1;
    };

    const stats = [
        {
            icon: <FireIcon className="h-3.5 w-3.5" />,
            value: streak,
            label: quit
                ? t('habits.stats.clean', 'clean {{unit}}', {
                      unit: periodNoun(t, habit, streak),
                  })
                : periodNoun(t, habit, streak),
        },
        {
            icon: <TrophyIcon className="h-3.5 w-3.5" />,
            value: best,
            label: t('habits.stats.best', 'best'),
        },
        {
            icon: <BoltIcon className="h-3.5 w-3.5" />,
            value: `${Math.round(habit.habit_strength ?? 0)}%`,
            label: t('habits.stats.strength', 'strength'),
        },
    ];

    return (
        <div
            className={`rounded-xl shadow-sm flex flex-col overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                done ? `${ACCENT.surface} ${SURFACE.outline}` : SURFACE.card
            }`}
            onClick={() => onOpen(habit)}
            style={habitAccentStyle(habit)}
        >
            <div className={`h-1 ${ACCENT.bg}`} aria-hidden="true" />
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3
                        className={`flex items-baseline gap-2 text-sm font-semibold tracking-wide leading-snug break-words ${
                            done
                                ? ACCENT.text
                                : 'text-gray-800 dark:text-gray-100'
                        }`}
                    >
                        <span
                            className={`shrink-0 w-2.5 h-2.5 rounded-full ${ACCENT.bg}`}
                            aria-hidden="true"
                        />
                        <span className="min-w-0">{habit.name}</span>
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs mt-1.5 text-gray-400 dark:text-gray-500">
                        {quit && (
                            <span className="px-1.5 py-px rounded bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 text-[10px] font-medium uppercase tracking-wide">
                                {t('habits.quit', 'Quit')}
                            </span>
                        )}
                        <span className="truncate">
                            {formatHabitTarget(t, habit)}
                        </span>
                        {habit.habit_reminder_time && (
                            <span className="flex items-center gap-0.5 shrink-0">
                                <BellIcon className="h-3 w-3" />
                                {habit.habit_reminder_time}
                            </span>
                        )}
                    </p>
                </div>
                <HabitCheckIn
                    habit={habit}
                    onCheckIn={(options) => onCheckIn(habit, options)}
                />
            </div>

            {!quit && habit.habit_progress && (
                <div className="px-5 pb-3">
                    <HabitProgressBar habit={habit} />
                </div>
            )}

            <div className="px-5 pb-4">
                <div
                    className="grid gap-[3px]"
                    style={{
                        gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`,
                    }}
                >
                    {days.map((date) => {
                        const key = toDayKey(date);
                        return (
                            <div
                                key={key}
                                title={date.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                                className={`aspect-square rounded-[2px] transition-colors ${dotClass(date)} ${
                                    key === todayKey
                                        ? 'outline outline-1 outline-offset-1 outline-gray-300 dark:outline-gray-500'
                                        : ''
                                }`}
                                style={{ opacity: dotOpacity(date) }}
                            />
                        );
                    })}
                </div>
            </div>

            <div
                className={`mt-auto rounded-b-xl flex items-stretch ${
                    done ? ACCENT.surfaceStrong : ACCENT.strip
                }`}
            >
                {stats.map(({ icon, value, label }) => (
                    <div
                        key={label}
                        className="flex-1 flex flex-col items-center py-3 gap-1"
                    >
                        <span
                            className={`text-base font-semibold leading-none tabular-nums ${
                                done
                                    ? ACCENT.text
                                    : 'text-gray-700 dark:text-gray-200'
                            }`}
                        >
                            {value}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] leading-none text-gray-400 dark:text-gray-500">
                            <span className={ACCENT.text}>{icon}</span>
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HabitCard;
