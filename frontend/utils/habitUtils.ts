import { Task } from '../entities/Task';

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff = day === 0 ? -6 : 1 - day; // adjust back to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function isHabitCompletedInPeriod(
    habit: Task,
    now: Date = new Date()
): boolean {
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
    } else {
        return (
            last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth() &&
            last.getDate() === now.getDate()
        );
    }
}
