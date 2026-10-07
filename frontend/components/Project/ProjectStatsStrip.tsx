import React, { useMemo } from 'react';
import { TFunction } from 'i18next';
import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { isTaskCompleted } from '../../constants/taskStatus';
import { getTodayDateString } from '../../utils/dateUtils';

interface ProjectStatsStripProps {
    tasks: Task[];
    project: Project;
    t: TFunction;
}

const ProjectStatsStrip: React.FC<ProjectStatsStripProps> = ({
    tasks,
    project,
    t,
}) => {
    const stats = useMemo(() => {
        const today = getTodayDateString();
        const weekAgo = subDays(new Date(), 7);
        let open = 0;
        let overdue = 0;
        let doneThisWeek = 0;
        tasks.forEach((task) => {
            if (isTaskCompleted(task.status)) {
                if (
                    task.completed_at &&
                    new Date(task.completed_at) >= weekAgo
                ) {
                    doneThisWeek += 1;
                }
                return;
            }
            open += 1;
            if (task.due_date && task.due_date.split('T')[0] < today) {
                overdue += 1;
            }
        });
        return { open, overdue, doneThisWeek };
    }, [tasks]);

    const dueDate = project.due_date_at ? new Date(project.due_date_at) : null;
    const daysLeft = dueDate
        ? differenceInCalendarDays(dueDate, new Date())
        : null;

    const items: {
        value: React.ReactNode;
        label: string;
        alert?: boolean;
    }[] = [
        {
            value: (
                <>
                    {stats.open}
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                        /{tasks.length}
                    </span>
                </>
            ),
            label: t('project.openTasks', 'Open tasks'),
        },
        {
            value: stats.overdue,
            label: t('project.overdueTasks', 'Overdue'),
            alert: stats.overdue > 0,
        },
        {
            value: stats.doneThisWeek,
            label: t('project.doneThisWeek', 'Done this week'),
        },
        {
            value:
                daysLeft === null ? (
                    '–'
                ) : (
                    <>
                        {Math.abs(daysLeft)}
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                            d
                        </span>
                    </>
                ),
            label:
                daysLeft === null
                    ? t('projectItem.noDueDate', 'No due date')
                    : daysLeft >= 0
                      ? t('project.untilDate', 'Until {{date}}', {
                            date: format(dueDate as Date, 'MMM d'),
                        })
                      : t('project.pastDate', 'Past {{date}}', {
                            date: format(dueDate as Date, 'MMM d'),
                        }),
            alert: daysLeft !== null && daysLeft < 0,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item, index) => (
                <div
                    key={index}
                    className="space-y-0.5 rounded-xl bg-white px-4 py-3 dark:bg-gray-900"
                >
                    <div
                        className={`text-xl font-semibold tabular-nums ${
                            item.alert
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-gray-100'
                        }`}
                    >
                        {item.value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.label}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProjectStatsStrip;
