import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { PlanCandidates } from '../../utils/dailyPlanService';

interface NotPlannedDrawerProps {
    candidates: PlanCandidates | null;
    plannedUids: Set<string>;
    onAdd: (task: Task) => void;
}

const NotPlannedDrawer: React.FC<NotPlannedDrawerProps> = ({
    candidates,
    plannedUids,
    onAdd,
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
        .map((g) => `${g.tasks.length} ${g.label.toLowerCase()}`)
        .join(' · ');

    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex min-h-[48px] items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:hover:bg-gray-900"
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
                <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    {groups.length === 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'dailyPlan.nothingElse',
                                'Nothing else is waiting.'
                            )}
                        </p>
                    )}
                    {groups.map((group) => (
                        <div key={group.key} className="flex flex-col gap-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                {group.label}
                            </p>
                            {group.tasks.map((task) => (
                                <div
                                    key={task.uid}
                                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    <Link
                                        to={`/task/${task.uid}`}
                                        className="min-w-0 flex-1 truncate text-sm text-gray-800 hover:underline dark:text-gray-200"
                                    >
                                        {task.name}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onAdd(task)}
                                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
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
                    <Link
                        to="/today_legacy"
                        className="self-start text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                    >
                        {t(
                            'dailyPlan.classicToday',
                            'Open the classic Today page'
                        )}
                    </Link>
                </div>
            )}
        </div>
    );
};

export default NotPlannedDrawer;
