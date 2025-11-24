import { useMemo, useCallback } from 'react';
import { Task } from '../../entities/Task';
import { TFunction } from 'i18next';

export const useProjectMetrics = (
    tasks: Task[],
    handleTaskUpdate: (task: Task) => Promise<void>,
    t: TFunction
) => {
    const taskStats = useMemo(() => {
        const stats = {
            total: tasks.length,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            overdue: 0,
            dueSoon: 0,
        };

        const today = new Date();
        const startOfToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
        const soonBoundary = new Date(startOfToday);
        soonBoundary.setDate(startOfToday.getDate() + 7);

        const isCompleted = (status: Task['status']) =>
            status === 'done' ||
            status === 'archived' ||
            status === 2 ||
            status === 3;

        const isInProgress = (status: Task['status']) =>
            status === 'in_progress' || status === 1;

        const isNotStarted = (status: Task['status']) =>
            status === 'not_started' || status === 0;

        tasks.forEach((task) => {
            const status = task.status;

            if (isCompleted(status)) {
                stats.completed += 1;
            } else if (isInProgress(status)) {
                stats.inProgress += 1;
            } else if (isNotStarted(status)) {
                stats.notStarted += 1;
            } else {
                stats.notStarted += 1;
            }

            if (!isCompleted(status) && task.due_date) {
                const dueDate = new Date(task.due_date);
                if (!Number.isNaN(dueDate.getTime())) {
                    if (dueDate < startOfToday) {
                        stats.overdue += 1;
                    } else if (dueDate <= soonBoundary) {
                        stats.dueSoon += 1;
                    }
                }
            }
        });

        const completionRate =
            stats.total > 0
                ? Math.round((stats.completed / stats.total) * 100)
                : 0;

        return {
            ...stats,
            completionRate,
        };
    }, [tasks]);

    const completionGradient = useMemo(() => {
        if (taskStats.total === 0) {
            return 'conic-gradient(#e5e7eb 0% 100%)';
        }

        const segments = [
            { value: taskStats.completed, color: '#22c55e' },
            { value: taskStats.inProgress, color: '#3b82f6' },
            { value: taskStats.notStarted, color: '#9ca3af' },
        ];

        let current = 0;
        const gradientStops: string[] = [];

        segments.forEach((segment) => {
            if (segment.value === 0) return;
            const start = current;
            const percentage = (segment.value / taskStats.total) * 100;
            const end = start + percentage;
            gradientStops.push(
                `${segment.color} ${start}% ${Math.min(end, 100)}%`
            );
            current += percentage;
        });

        return gradientStops.length
            ? `conic-gradient(${gradientStops.join(', ')})`
            : 'conic-gradient(#e5e7eb 0% 100%)';
    }, [taskStats]);

    const dueBuckets = useMemo(() => {
        const buckets = {
            overdue: [] as Task[],
            week: [] as Task[],
            month: [] as Task[],
            unscheduled: [] as Task[],
        };

        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
        const weekBoundary = new Date(startOfToday);
        weekBoundary.setDate(startOfToday.getDate() + 7);
        const monthBoundary = new Date(startOfToday);
        monthBoundary.setDate(startOfToday.getDate() + 30);

        const isCompleted = (status: Task['status']) =>
            status === 'done' ||
            status === 'archived' ||
            status === 2 ||
            status === 3;

        tasks.forEach((task) => {
            if (isCompleted(task.status)) return;

            if (!task.due_date) {
                buckets.unscheduled.push(task);
                return;
            }

            const due = new Date(task.due_date);
            if (Number.isNaN(due.getTime())) {
                buckets.unscheduled.push(task);
                return;
            }

            if (due < startOfToday) {
                buckets.overdue.push(task);
            } else if (due <= weekBoundary) {
                buckets.week.push(task);
            } else if (due <= monthBoundary) {
                buckets.month.push(task);
            } else {
                buckets.unscheduled.push(task);
            }
        });

        const totalDue =
            buckets.overdue.length + buckets.week.length + buckets.month.length;

        return { ...buckets, totalDue };
    }, [tasks]);

    const completionTrend = useMemo(() => {
        const days = 14;
        const today = new Date();
        const labels: { dateKey: string; label: string }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            labels.push({
                dateKey: key,
                label: `${d.getMonth() + 1}/${d.getDate()}`,
            });
        }

        const counts: Record<string, number> = {};
        labels.forEach((l) => (counts[l.dateKey] = 0));

        tasks.forEach((task) => {
            if (!task.completed_at) return;
            const key = new Date(task.completed_at).toISOString().split('T')[0];
            if (counts[key] !== undefined) {
                counts[key] += 1;
            }
        });

        return labels.map((l) => ({
            label: l.label,
            dateKey: l.dateKey,
            count: counts[l.dateKey] || 0,
        }));
    }, [tasks]);

    const createdTrend = useMemo(() => {
        const days = 14;
        const today = new Date();
        const labels: { dateKey: string; label: string }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            labels.push({
                dateKey: key,
                label: `${d.getMonth() + 1}/${d.getDate()}`,
            });
        }

        const counts: Record<string, number> = {};
        labels.forEach((l) => (counts[l.dateKey] = 0));

        tasks.forEach((task) => {
            if (!task.created_at) return;
            const key = new Date(task.created_at).toISOString().split('T')[0];
            if (counts[key] !== undefined) {
                counts[key] += 1;
            }
        });

        return labels.map((l) => ({
            label: l.label,
            dateKey: l.dateKey,
            count: counts[l.dateKey] || 0,
        }));
    }, [tasks]);

    const upcomingDueTrend = useMemo(() => {
        const days = 14;
        const today = new Date();
        const labels: { dateKey: string; label: string }[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const key = d.toISOString().split('T')[0];
            labels.push({
                dateKey: key,
                label: `${d.getMonth() + 1}/${d.getDate()}`,
            });
        }

        const counts: Record<string, number> = {};
        labels.forEach((l) => (counts[l.dateKey] = 0));

        const isCompleted = (status: Task['status']) =>
            status === 'done' ||
            status === 'archived' ||
            status === 2 ||
            status === 3;

        tasks.forEach((task) => {
            if (!task.due_date || isCompleted(task.status)) return;
            const key = new Date(task.due_date).toISOString().split('T')[0];
            if (counts[key] !== undefined) {
                counts[key] += 1;
            }
        });

        return labels.map((l) => ({
            label: l.label,
            dateKey: l.dateKey,
            count: counts[l.dateKey] || 0,
        }));
    }, [tasks]);

    const upcomingInsights = useMemo(() => {
        const peak = upcomingDueTrend.reduce(
            (acc, cur) => (cur.count > acc.count ? cur : acc),
            { label: '', count: 0 }
        );
        const nextThreeDays = upcomingDueTrend
            .slice(0, 3)
            .reduce((sum, d) => sum + d.count, 0);
        const nextWeek = upcomingDueTrend
            .slice(0, 7)
            .reduce((sum, d) => sum + d.count, 0);

        return {
            peakLabel: peak.label,
            peakCount: peak.count,
            nextThreeDays,
            nextWeek,
        };
    }, [upcomingDueTrend]);

    const eisenhower = useMemo(() => {
        const buckets = {
            urgentImportant: 0,
            urgentNotImportant: 0,
            notUrgentImportant: 0,
            notUrgentNotImportant: 0,
        };

        const today = new Date();
        const startOfToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
        const threeDays = new Date(startOfToday);
        threeDays.setDate(startOfToday.getDate() + 3);

        const isCompleted = (status: Task['status']) =>
            status === 'done' ||
            status === 'archived' ||
            status === 2 ||
            status === 3;

        tasks.forEach((task) => {
            if (isCompleted(task.status)) return;

            const isUrgent = (() => {
                if (!task.due_date) return false;
                const due = new Date(task.due_date);
                if (Number.isNaN(due.getTime())) return false;
                return due <= threeDays;
            })();

            const isImportant =
                task.priority === 'high' ||
                task.priority === 2 ||
                task.priority === 'medium' ||
                task.priority === 1;

            if (isUrgent && isImportant) buckets.urgentImportant += 1;
            else if (isUrgent && !isImportant) buckets.urgentNotImportant += 1;
            else if (!isUrgent && isImportant) buckets.notUrgentImportant += 1;
            else buckets.notUrgentNotImportant += 1;
        });

        return buckets;
    }, [tasks]);

    const dueHighlights = useMemo(() => {
        const combined = [
            ...dueBuckets.overdue,
            ...dueBuckets.week,
            ...dueBuckets.month,
        ];

        return combined
            .sort((a, b) => {
                const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
                const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
                return aDate - bDate;
            })
            .slice(0, 3);
    }, [dueBuckets]);

    const nextBestAction = useMemo(() => {
        const isCompleted = (status: Task['status']) =>
            status === 'done' ||
            status === 'archived' ||
            status === 2 ||
            status === 3;

        const candidates = tasks.filter(
            (task) =>
                !isCompleted(task.status) &&
                task.status !== 'in_progress' &&
                task.status !== 1
        );
        if (candidates.length === 0) return null;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const getPriorityScore = (priority: Task['priority']) => {
            if (priority === 'high' || priority === 2) return -8;
            if (priority === 'medium' || priority === 1) return -4;
            return 0;
        };

        const scored = candidates
            .map((task) => {
                let score = 0;

                if (task.status === 'in_progress' || task.status === 1) {
                    score -= 30;
                }

                if (task.due_date) {
                    const due = new Date(task.due_date);
                    const diffDays = Math.floor(
                        (due.getTime() - startOfToday.getTime()) /
                            (1000 * 60 * 60 * 24)
                    );
                    if (diffDays < 0) score -= 25;
                    else if (diffDays === 0) score -= 20;
                    else if (diffDays <= 2) score -= 15;
                    else if (diffDays <= 7) score -= 10;
                }

                score += getPriorityScore(task.priority);

                if (task.today) {
                    score -= 6;
                }

                const createdAt = task.created_at
                    ? new Date(task.created_at).getTime()
                    : 0;

                return {
                    task,
                    score,
                    createdAt,
                };
            })
            .sort((a, b) => {
                if (a.score !== b.score) return a.score - b.score;
                if (a.createdAt !== b.createdAt)
                    return a.createdAt - b.createdAt;
                return (a.task.id || 0) - (b.task.id || 0);
            });

        return scored[0]?.task ?? null;
    }, [tasks]);

    const getDueDescriptor = useCallback(
        (task: Task): string => {
            if (!task.due_date)
                return t('tasks.noDue', 'No due date') as string;

            const now = new Date();
            const startOfToday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
            const due = new Date(task.due_date);
            if (Number.isNaN(due.getTime()))
                return t('tasks.noDue', 'No due date') as string;

            const diffDays = Math.floor(
                (due.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDays < 0) {
                return t('tasks.overdueBy', {
                    defaultValue: 'Overdue by {{days}}d',
                    days: Math.abs(diffDays),
                }) as string;
            }
            if (diffDays === 0)
                return t('dateIndicators.today', 'Today') as string;
            if (diffDays === 1)
                return t('dateIndicators.tomorrow', 'Tomorrow') as string;
            if (diffDays <= 7)
                return t('tasks.dueInDays', {
                    defaultValue: 'Due in {{days}}d',
                    days: diffDays,
                }) as string;

            return t('tasks.dueInDays', {
                defaultValue: 'Due in {{days}}d',
                days: diffDays,
            }) as string;
        },
        [t]
    );

    const handleStartNextAction = useCallback(async () => {
        if (!nextBestAction?.id) return;

        const isAlreadyInProgress =
            nextBestAction.status === 'in_progress' ||
            nextBestAction.status === 1;
        const isAlreadyToday = !!nextBestAction.today;

        if (isAlreadyInProgress && isAlreadyToday) {
            return;
        }

        try {
            await handleTaskUpdate({
                ...nextBestAction,
                status: 'in_progress',
                today: true,
            });
        } catch {
            // Silent fail
        }
    }, [handleTaskUpdate, nextBestAction]);

    const weeklyPace = useMemo(() => {
        const lastWeek = completionTrend
            .slice(-7)
            .reduce((sum, d) => sum + d.count, 0);
        const prevWeek = completionTrend
            .slice(0, -7)
            .reduce((sum, d) => sum + d.count, 0);
        const delta = lastWeek - prevWeek;
        return { lastWeek, prevWeek, delta };
    }, [completionTrend]);

    const monthlyCompleted = useMemo(() => {
        const today = new Date();
        const startWindow = new Date();
        startWindow.setDate(today.getDate() - 30);
        let count = 0;
        tasks.forEach((task) => {
            if (!task.completed_at) return;
            const completedDate = new Date(task.completed_at);
            if (
                !Number.isNaN(completedDate.getTime()) &&
                completedDate >= startWindow
            ) {
                count += 1;
            }
        });
        return count;
    }, [tasks]);

    return {
        taskStats,
        completionGradient,
        dueBuckets,
        dueHighlights,
        nextBestAction,
        getDueDescriptor,
        handleStartNextAction,
        completionTrend,
        upcomingDueTrend,
        createdTrend,
        upcomingInsights,
        eisenhower,
        weeklyPace,
        monthlyCompleted,
    };
};
