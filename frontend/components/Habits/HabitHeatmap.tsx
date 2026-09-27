import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { ACCENT } from '../../constants/colorPalette';
import {
    DayTotals,
    dayFraction,
    formatAmount,
    isQuitHabit,
    isScheduledOn,
    toDayKey,
    weekdayLabel,
} from '../../utils/habitUtils';

interface HabitHeatmapProps {
    habit: Task;
    year: number;
    minYear: number;
    totals: Map<string, DayTotals>;
    firstDayOfWeek: number;
    selectedKey: string | null;
    loading?: boolean;
    onSelect: (date: Date) => void;
    onYearChange: (year: number) => void;
}

// One year as week columns, like a contribution graph. Clicking a day opens
// it in the day panel.
const HabitHeatmap: React.FC<HabitHeatmapProps> = ({
    habit,
    year,
    minYear,
    totals,
    firstDayOfWeek,
    selectedKey,
    loading,
    onSelect,
    onYearChange,
}) => {
    const { t } = useTranslation();
    const quit = isQuitHabit(habit);
    const today = new Date();
    const todayKey = toDayKey(today);
    const createdKey = habit.created_at
        ? toDayKey(new Date(habit.created_at))
        : todayKey;

    const weeks = useMemo(() => {
        const start = new Date(year, 0, 1);
        start.setDate(
            start.getDate() - ((start.getDay() - firstDayOfWeek + 7) % 7)
        );
        const end = new Date(year, 11, 31);
        const columns: Date[][] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            const column: Date[] = [];
            for (let i = 0; i < 7; i++) {
                column.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }
            columns.push(column);
        }
        return columns;
    }, [year, firstDayOfWeek]);

    const monthLabels = weeks.map((column, index) => {
        const firstOfMonth = column.find(
            (d) => d.getDate() === 1 && d.getFullYear() === year
        );
        if (!firstOfMonth && index !== 0) return null;
        const date = firstOfMonth || new Date(year, 0, 1);
        return date.toLocaleDateString(undefined, { month: 'short' });
    });

    const cell = (date: Date) => {
        const key = toDayKey(date);
        const dayTotals = totals.get(key);
        const outside = date.getFullYear() !== year;
        const future = key > todayKey;
        let className = 'bg-gray-100 dark:bg-gray-800';
        let opacity = 1;
        let label = '';

        if (outside) {
            className = 'bg-transparent';
        } else if (loading) {
            className = 'bg-gray-100 dark:bg-gray-800 animate-pulse';
        } else if (quit) {
            if (dayTotals && dayTotals.checkIns > 0) {
                className = 'bg-red-400 dark:bg-red-500';
                label = t('habits.slip', 'Slip');
            } else if (key >= createdKey && !future) {
                className = ACCENT.bg;
                opacity = 0.6;
                label = t('habits.clean', 'Clean');
            }
        } else if (dayTotals?.skipped && dayTotals.checkIns === 0) {
            className = 'bg-sky-200 dark:bg-sky-800';
            label = t('habits.skipped', 'Skipped');
        } else if (dayTotals && dayTotals.checkIns > 0) {
            const fraction = dayFraction(habit, dayTotals);
            className = ACCENT.bg;
            opacity = 0.3 + fraction * 0.7;
            label = `${formatAmount(dayTotals.progress)}${habit.habit_unit && typeof habit.habit_target_value === 'number' ? ` ${habit.habit_unit}` : '×'}`;
        } else if (!isScheduledOn(habit, date)) {
            className = 'bg-gray-50 dark:bg-gray-800/40';
            label = t('habits.dayOff', 'Day off');
        }

        const title = `${date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })}${label ? `: ${label}` : ''}`;

        return (
            <button
                key={key}
                type="button"
                disabled={outside || future}
                onClick={() => onSelect(date)}
                title={title}
                aria-label={title}
                aria-pressed={selectedKey === key}
                className={`w-[11px] h-[11px] rounded-[2px] ${className} ${
                    outside || future
                        ? 'cursor-default'
                        : 'cursor-pointer hover:ring-1 hover:ring-gray-400'
                } ${
                    selectedKey === key
                        ? 'ring-2 ring-blue-500'
                        : key === todayKey
                          ? 'ring-1 ring-blue-400'
                          : ''
                } ${future && !outside ? 'opacity-40' : ''}`}
                style={future ? undefined : { opacity }}
            />
        );
    };

    const rowLabels = Array.from(
        { length: 7 },
        (_, i) => (firstDayOfWeek + i) % 7
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('habits.historyTitle', 'History')}
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onYearChange(year - 1)}
                        disabled={year <= minYear}
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label={t('habits.previousYear', 'Previous year')}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-200 w-12 text-center">
                        {year}
                    </span>
                    <button
                        type="button"
                        onClick={() => onYearChange(year + 1)}
                        disabled={year >= today.getFullYear()}
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label={t('habits.nextYear', 'Next year')}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto pb-2">
                <div className="inline-flex gap-1.5">
                    <div className="flex flex-col gap-[2px] pt-4 text-[9px] text-gray-400 dark:text-gray-500">
                        {rowLabels.map((day, i) => (
                            <span key={day} className="h-[11px] leading-[11px]">
                                {i % 2 === 0 ? weekdayLabel(day) : ''}
                            </span>
                        ))}
                    </div>
                    <div>
                        <div className="flex gap-[2px] h-4 text-[9px] text-gray-400 dark:text-gray-500">
                            {monthLabels.map((label, i) => (
                                <span
                                    key={i}
                                    className="w-[11px] whitespace-nowrap overflow-visible"
                                >
                                    {label || ''}
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-[2px]">
                            {weeks.map((column, i) => (
                                <div
                                    key={i}
                                    className="flex flex-col gap-[2px]"
                                >
                                    {column.map(cell)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                {quit ? (
                    <>
                        <Legend
                            className={`${ACCENT.bg} opacity-60`}
                            label={t('habits.clean', 'Clean')}
                        />
                        <Legend
                            className="bg-red-400"
                            label={t('habits.slip', 'Slip')}
                        />
                    </>
                ) : (
                    <>
                        <Legend
                            className={`${ACCENT.bg} opacity-40`}
                            label={t('habits.partial', 'Partial')}
                        />
                        <Legend
                            className={ACCENT.bg}
                            label={t('habits.completed', 'Completed')}
                        />
                        <Legend
                            className="bg-sky-200 dark:bg-sky-800"
                            label={t('habits.skipped', 'Skipped')}
                        />
                    </>
                )}
                <Legend
                    className="bg-gray-100 dark:bg-gray-800 ring-1 ring-blue-400"
                    label={t('habits.today', 'Today')}
                />
            </div>
        </div>
    );
};

const Legend: React.FC<{ className: string; label: string }> = ({
    className,
    label,
}) => (
    <span className="flex items-center gap-1">
        <span className={`w-2.5 h-2.5 rounded-sm ${className}`} />
        {label}
    </span>
);

export default HabitHeatmap;
