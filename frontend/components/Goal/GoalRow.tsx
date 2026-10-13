import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';
import { createGoalUrl } from '../../utils/slugUtils';

export const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

interface GoalRowProps {
    goal: Goal;
    // Shown in the menu when given; the Goals page passes its confirm dialog.
    onDelete?: (goal: Goal) => void;
    // Shown in the menu when given, e.g. on an area's goal list.
    onRemoveFromArea?: (goal: Goal) => void;
}

// One goal in a list, the same row on the Goals page and on an area page.
// The root is meant to sit directly inside a task-sheet list.
const GoalRow: React.FC<GoalRowProps> = ({
    goal,
    onDelete,
    onRemoveFromArea,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const goalUrl = goal.uid
        ? createGoalUrl({ uid: goal.uid, title: goal.title })
        : '/goals';
    const effectiveColor = goal.color || goal.Area?.color;
    const projectsCount =
        (goal as any).projects_count ?? goal.Projects?.length ?? 0;
    const tasksCount = (goal as any).tasks_count ?? goal.Tasks?.length ?? 0;

    const menuItemClass =
        'block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600';

    return (
        <div
            className={`relative flex items-center gap-4 -ml-1.5 py-2.5 pl-5 pr-2 border-l-4 border-gray-300 dark:border-gray-600 group ${
                menuOpen ? 'z-50' : ''
            }`}
            style={{ borderLeftColor: effectiveColor || undefined }}
        >
            <Link to={goalUrl} className="flex-1 min-w-0">
                <h3 className="text-[15px] font-normal tracking-tight text-gray-900 dark:text-gray-100 truncate">
                    {goal.title}
                </h3>
                {goal.why && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {goal.why}
                    </p>
                )}
                {goal.Area && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {goal.Area.name}
                    </p>
                )}
            </Link>

            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <span
                    className={`inline-flex items-center px-2 py-px rounded-full text-[10px] font-medium ${
                        STATUS_COLORS[goal.status] ?? ''
                    }`}
                >
                    {t(`goals.status.${goal.status}`, goal.status)}
                </span>
                <span className="inline-flex items-center px-2 py-px rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {t(`goals.horizon.${goal.horizon}`, goal.horizon)}
                </span>
            </div>

            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 w-40 justify-end">
                <span>
                    {projectsCount} {t('goals.stats.projects', 'projects')}
                </span>
                <span>
                    {tasksCount} {t('goals.stats.tasks', 'tasks')}
                </span>
            </div>

            <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen((open) => !open);
                    }}
                    className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60] overflow-hidden">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(false);
                                navigate(goalUrl);
                            }}
                            className={`${menuItemClass} text-gray-700 dark:text-gray-300`}
                        >
                            {t('common.edit', 'Edit')}
                        </button>
                        {onRemoveFromArea && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onRemoveFromArea(goal);
                                }}
                                className={`${menuItemClass} text-gray-700 dark:text-gray-300`}
                            >
                                {t('goals.removeFromArea', 'Remove from area')}
                            </button>
                        )}
                        {onDelete && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete(goal);
                                }}
                                className={`${menuItemClass} text-red-500 dark:text-red-300`}
                            >
                                {t('common.delete', 'Delete')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoalRow;
