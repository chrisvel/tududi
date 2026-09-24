import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { PlanCandidates } from '../../utils/dailyPlanService';
import TaskRow from '../Task/TaskRow';

interface NotPlannedDrawerProps {
    candidates: PlanCandidates | null;
    plannedUids: Set<string>;
    onAdd: (task: Task) => void;
    projects: Project[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskDelete: (taskUid: string) => Promise<void>;
}

const NotPlannedDrawer: React.FC<NotPlannedDrawerProps> = ({
    candidates,
    plannedUids,
    onAdd,
    projects,
    onTaskUpdate,
    onTaskDelete,
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    if (!candidates) return null;

    const notPlanned = (tasks: Task[]) =>
        tasks.filter((task) => task.uid && !plannedUids.has(task.uid));
    const groups = [
        {
            key: 'overdue',
            label: t('dailyPlan.overdue', 'Overdue'),
            tasks: notPlanned(candidates.overdue),
        },
        {
            key: 'due_today',
            label: t('dailyPlan.dueToday', 'Due today'),
            tasks: notPlanned(candidates.due_today),
        },
        {
            key: 'in_progress',
            label: t('dailyPlan.inProgress', 'In progress'),
            tasks: notPlanned(candidates.in_progress),
        },
        {
            key: 'suggested',
            label: t('dailyPlan.suggested', 'Suggested'),
            tasks: notPlanned(candidates.suggested),
        },
    ].filter((group) => group.tasks.length > 0);
    const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);
    const summary = groups
        .map((g) =>
            t(`dailyPlan.countOf.${g.key}`, {
                count: g.tasks.length,
                defaultValue: `{{count}} ${g.label.toLowerCase()}`,
            })
        )
        .join(' · ');

    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex min-h-[48px] items-center gap-3 rounded-xl bg-gray-100/70 px-5 text-left hover:bg-gray-100 dark:bg-gray-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-900"
                data-testid="not-planned-toggle"
            >
                <ChevronRightIcon
                    className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                    {t('dailyPlan.notPlanned', 'Not planned ({{count}})', {
                        count: total,
                    })}
                </span>
                {summary && (
                    <span className="truncate text-sm text-gray-500 dark:text-gray-400">
                        {summary}
                    </span>
                )}
            </button>

            {open && (
                <div className="flex flex-col gap-4">
                    {groups.length === 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'dailyPlan.nothingElse',
                                'Nothing else is waiting.'
                            )}
                        </p>
                    )}
                    {groups.map((group) => (
                        <div key={group.key} className="flex flex-col gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                {group.label}
                            </p>
                            {group.tasks.map((task) => (
                                <div
                                    key={task.uid}
                                    className="flex items-start gap-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <TaskRow
                                            task={task}
                                            projects={projects}
                                            onTaskUpdate={onTaskUpdate}
                                            onTaskCompletionToggle={(
                                                updated
                                            ) => {
                                                void onTaskUpdate(updated);
                                            }}
                                            onTaskDelete={onTaskDelete}
                                            compact
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onAdd(task)}
                                        className="mt-1.5 inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        {t(
                                            'dailyPlan.addToToday',
                                            'Add to today'
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotPlannedDrawer;
