import { TFunction } from 'i18next';
import { Task, HabitTimeOfDay } from '../entities/Task';
import { HabitCompletion } from './habitsService';
import {
    PALETTE,
    PaletteColor,
    accentVars,
    resolveColor,
} from '../constants/colorPalette';

const DEFAULT_HABIT_COLOR = PALETTE.find((c) => c.key === 'green')!;

export function habitColor(habit: Task): PaletteColor {
    return resolveColor(habit.habit_color) || DEFAULT_HABIT_COLOR;
}

// Sets the accent variables that every habit component colors itself with.
export function habitAccentStyle(habit: Task) {
    return accentVars(habitColor(habit));
}

export const TIMES_OF_DAY: HabitTimeOfDay[] = [
    'morning',
    'afternoon',
    'evening',
];

export function toDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isQuitHabit(habit: Task): boolean {
    return habit.habit_polarity === 'quit';
}

export function isMeasurableHabit(habit: Task): boolean {
    return (
        !isQuitHabit(habit) &&
        typeof habit.habit_target_value === 'number' &&
        habit.habit_target_value > 0
    );
}

export function habitGoal(habit: Task): number {
    if (isMeasurableHabit(habit)) return habit.habit_target_value as number;
    return Math.max(1, habit.habit_target_count || 1);
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// "Done for now": the goal for the current period is met. Uses the server's
// progress when present, falling back to the last check-in for older data.
export function isHabitCompletedInPeriod(
    habit: Task,
    now: Date = new Date()
): boolean {
    if (habit.habit_progress) {
        if (isQuitHabit(habit)) return false;
        return habit.habit_progress.met;
    }
    if (!habit.habit_last_completion_at) return false;
    const last = new Date(habit.habit_last_completion_at);
    const period = habit.habit_frequency_period ?? 'daily';

    if (period === 'weekly') {
        const weekStart = getWeekStart(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return last >= weekStart && last <= weekEnd;
    } else if (period === 'monthly') {
        return (
            last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth()
        );
    }
    return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
    );
}

export function formatAmount(value: number): string {
    return Number.isInteger(value)
        ? String(value)
        : value.toFixed(value < 10 ? 2 : 1).replace(/\.?0+$/, '');
}

export function periodNoun(t: TFunction, habit: Task, count: number): string {
    switch (habit.habit_frequency_period) {
        case 'weekly':
            return count === 1
                ? t('habits.unit.week', 'week')
                : t('habits.unit.weeks', 'weeks');
        case 'monthly':
            return count === 1
                ? t('habits.unit.month', 'month')
                : t('habits.unit.months', 'months');
        case 'interval':
            return count === 1
                ? t('habits.unit.period', 'period')
                : t('habits.unit.periods', 'periods');
        default:
            return count === 1
                ? t('habits.unit.day', 'day')
                : t('habits.unit.days', 'days');
    }
}

function periodPhrase(t: TFunction, habit: Task): string {
    switch (habit.habit_frequency_period) {
        case 'weekly':
            return t('habits.perWeek', 'a week');
        case 'monthly':
            return t('habits.perMonth', 'a month');
        case 'interval':
            return t('habits.perInterval', 'every {{count}} days', {
                count: habit.habit_interval_days || 2,
            });
        default:
            return t('habits.perDay', 'a day');
    }
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayLabel(day: number): string {
    const base = new Date(2026, 0, 4 + day); // 2026-01-04 is a Sunday
    try {
        return base.toLocaleDateString(undefined, { weekday: 'short' });
    } catch {
        return WEEKDAY_SHORT[day];
    }
}

export function scheduleSummary(t: TFunction, habit: Task): string | null {
    const days = habit.habit_schedule_days;
    if (
        habit.habit_frequency_period !== 'daily' &&
        habit.habit_frequency_period !== undefined
    ) {
        return null;
    }
    if (!days || days.length === 0 || days.length === 7) return null;
    const key = [...days].sort().join(',');
    if (key === '1,2,3,4,5') return t('habits.weekdays', 'Weekdays');
    if (key === '0,6') return t('habits.weekends', 'Weekends');
    return [...days].sort().map(weekdayLabel).join(', ');
}

// "20 pages a day", "3× a week", "Avoid, daily".
export function formatHabitTarget(t: TFunction, habit: Task): string {
    if (isQuitHabit(habit)) {
        return t('habits.quitTarget', 'Avoid');
    }
    const goal = habitGoal(habit);
    const amount = isMeasurableHabit(habit)
        ? `${formatAmount(goal)}${habit.habit_unit ? ` ${habit.habit_unit}` : ''}`
        : `${goal}×`;
    const schedule = scheduleSummary(t, habit);
    const phrase = `${amount} ${periodPhrase(t, habit)}`;
    return schedule ? `${phrase} · ${schedule}` : phrase;
}

export interface DayTotals {
    progress: number;
    checkIns: number;
    skipped: boolean;
    entries: HabitCompletion[];
}

export function totalsByDay(
    habit: Task,
    completions: HabitCompletion[]
): Map<string, DayTotals> {
    const measurable = isMeasurableHabit(habit);
    const map = new Map<string, DayTotals>();
    for (const entry of completions) {
        const key = toDayKey(new Date(entry.completed_at));
        const totals = map.get(key) || {
            progress: 0,
            checkIns: 0,
            skipped: false,
            entries: [],
        };
        totals.entries.push(entry);
        if (entry.skipped) {
            totals.skipped = true;
        } else {
            totals.checkIns += 1;
            totals.progress += measurable ? Number(entry.value) || 0 : 1;
        }
        map.set(key, totals);
    }
    return map;
}

// How full a single day's cell is (0-1). Weekly/monthly habits have no daily
// goal, so any check-in fills the day.
export function dayFraction(habit: Task, totals?: DayTotals): number {
    if (!totals || totals.checkIns === 0) return 0;
    if (isQuitHabit(habit)) return 1;
    const period = habit.habit_frequency_period || 'daily';
    if (period !== 'daily') return 1;
    return Math.min(1, totals.progress / habitGoal(habit));
}

export function isScheduledOn(habit: Task, date: Date): boolean {
    const days = habit.habit_schedule_days;
    if ((habit.habit_frequency_period || 'daily') !== 'daily') return true;
    if (!days || days.length === 0) return true;
    return days.includes(date.getDay());
}
