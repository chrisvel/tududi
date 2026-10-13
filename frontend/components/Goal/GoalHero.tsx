import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TFunction } from 'i18next';
import { format } from 'date-fns';
import {
    CheckIcon,
    ChevronDownIcon,
    EllipsisHorizontalIcon,
    FlagIcon,
    PencilSquareIcon,
    ShareIcon,
} from '@heroicons/react/24/outline';
import { Goal, GoalStatus } from '../../entities/Goal';

const GOAL_STATUSES: GoalStatus[] = ['active', 'paused', 'achieved', 'dropped'];

const GOAL_STATUS_TINT: Record<GoalStatus, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

interface GoalHeroProps {
    goal: Goal;
    t: TFunction;
    doneCount: number;
    totalCount: number;
    onStatusChange: (status: GoalStatus) => Promise<void>;
    onShareClick: () => void;
    onEditClick: () => void;
    onDeleteClick: () => void;
}

// Same card as the project header: tinted surface, status pill, title,
// actions, and a progress bar with a time marker.
const GoalHero: React.FC<GoalHeroProps> = ({
    goal,
    t,
    doneCount,
    totalCount,
    onStatusChange,
    onShareClick,
    onEditClick,
    onDeleteClick,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [statusOpen, setStatusOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen && !statusOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setMenuOpen(false);
            }
            if (statusRef.current && !statusRef.current.contains(target)) {
                setStatusOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen, statusOpen]);

    const changeStatus = async (status: GoalStatus) => {
        setStatusOpen(false);
        if (status === goal.status) return;
        await onStatusChange(status).catch(() => undefined);
    };

    const percent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const startDate = goal.created_at ? new Date(goal.created_at) : null;
    const targetDate = goal.target_date ? new Date(goal.target_date) : null;
    const today = new Date();
    // How much of the time between creation and target date has passed.
    const timeUsed =
        startDate && targetDate && targetDate > startDate
            ? Math.min(
                  100,
                  Math.max(
                      0,
                      Math.round(
                          ((today.getTime() - startDate.getTime()) /
                              (targetDate.getTime() - startDate.getTime())) *
                              100
                      )
                  )
              )
            : null;

    const tint = goal.color || goal.Area?.color || '#3b82f6';
    const actionClass =
        'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

    const areaSlug = goal.Area
        ? goal.Area.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
        : '';

    return (
        <div className="mb-6 space-y-3">
            <div
                className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 dark:bg-gray-900"
                style={{
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${tint} 10%, transparent), color-mix(in srgb, ${tint} 10%, transparent))`,
                }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <span
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-4 ring-white dark:bg-gray-800 dark:ring-gray-900"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 18%, transparent)`,
                            color: tint,
                        }}
                    >
                        <FlagIcon className="h-7 w-7" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <div className="relative" ref={statusRef}>
                                <button
                                    type="button"
                                    onClick={() => setStatusOpen((v) => !v)}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-opacity hover:opacity-80 ${GOAL_STATUS_TINT[goal.status]}`}
                                    aria-haspopup="menu"
                                    aria-expanded={statusOpen}
                                >
                                    {t(
                                        `goals.status.${goal.status}`,
                                        goal.status
                                    )}
                                    <ChevronDownIcon className="h-3 w-3" />
                                </button>
                                {statusOpen && (
                                    <div
                                        role="menu"
                                        className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-md bg-white py-1 shadow-lg dark:bg-gray-800"
                                    >
                                        {GOAL_STATUSES.map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                role="menuitem"
                                                onClick={() =>
                                                    changeStatus(status)
                                                }
                                                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                                    status === goal.status
                                                        ? 'text-gray-900 dark:text-gray-100'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <span
                                                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${GOAL_STATUS_TINT[status]}`}
                                                >
                                                    {t(
                                                        `goals.status.${status}`,
                                                        status
                                                    )}
                                                </span>
                                                {status === goal.status && (
                                                    <CheckIcon className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <span>
                                {t(
                                    `goals.horizon.${goal.horizon}`,
                                    goal.horizon
                                )}
                            </span>
                            {targetDate && (
                                <>
                                    <span>·</span>
                                    <span>
                                        {t('goals.targetDate', 'Target')}{' '}
                                        {format(targetDate, 'MMM d, yyyy')}
                                    </span>
                                </>
                            )}
                            {goal.Area && (
                                <>
                                    <span>·</span>
                                    <Link
                                        to={`/area/${goal.Area.uid}-${areaSlug}`}
                                        className="hover:underline"
                                    >
                                        {goal.Area.name}
                                    </Link>
                                </>
                            )}
                        </div>

                        <h1
                            className="line-clamp-2 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl dark:text-gray-100"
                            data-testid="goal-title"
                        >
                            {goal.title}
                        </h1>
                        {goal.why && (
                            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                {goal.why}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onShareClick}
                            className={actionClass}
                        >
                            <ShareIcon className="h-4 w-4" />
                            {t('projectItem.share', 'Share')}
                        </button>
                        <button
                            type="button"
                            onClick={onEditClick}
                            className={actionClass}
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            {t('common.edit', 'Edit')}
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setMenuOpen((v) => !v)}
                                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                aria-label={t(
                                    'project.moreOptions',
                                    'More options'
                                )}
                                aria-expanded={menuOpen}
                            >
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md bg-white py-1 shadow-lg dark:bg-gray-800">
                                    <button
                                        type="button"
                                        className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onDeleteClick();
                                        }}
                                    >
                                        {t('common.delete', 'Delete')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className="space-y-2"
                    title={
                        timeUsed !== null
                            ? t(
                                  'goals.progressHint',
                                  'Bar: tasks done. Line: time passed between creation and target date.'
                              )
                            : undefined
                    }
                >
                    <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        <span>
                            {t(
                                'goals.progressSummary',
                                'Goal progress · {{done}} of {{total}} tasks done',
                                {
                                    done: doneCount,
                                    total: totalCount,
                                }
                            )}
                            {timeUsed !== null &&
                                ` · ${t('project.timeUsed', '{{percent}}% of time used', { percent: timeUsed })}`}
                        </span>
                        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {percent}
                            <span className="ml-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                %
                            </span>
                        </span>
                    </div>
                    <div
                        className="relative h-1.5 rounded-full"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 20%, transparent)`,
                        }}
                    >
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                        />
                        {timeUsed !== null && (
                            <div
                                className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-gray-900/50 dark:bg-gray-100/50"
                                style={{ left: `${timeUsed}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoalHero;
