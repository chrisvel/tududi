import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, FlagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Goal } from '../../../entities/Goal';
import { Task } from '../../../entities/Task';
import { createGoalUrl } from '../../../utils/slugUtils';

interface TaskGoalCardProps {
    task: Task;
    goals: Goal[];
    onGoalSelect: (goal: Goal) => Promise<void>;
    onGoalClear: () => Promise<void>;
}

const TaskGoalCard: React.FC<TaskGoalCardProps> = ({
    task,
    goals,
    onGoalSelect,
    onGoalClear,
}) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedGoal = goals.find((g) => g.id === task.goal_id) ?? null;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setDropdownOpen(false);
                setSearchQuery('');
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [dropdownOpen]);

    const filteredGoals = goals.filter((g) =>
        g.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeGoals = filteredGoals.filter((g) => g.status === 'active');
    const inactiveGoals = filteredGoals.filter((g) => g.status !== 'active');

    const handleSelect = async (goal: Goal) => {
        await onGoalSelect(goal);
        setDropdownOpen(false);
        setSearchQuery('');
    };

    const handleClear = async () => {
        await onGoalClear();
        setDropdownOpen(false);
        setSearchQuery('');
    };

    return (
        <div ref={dropdownRef} className="space-y-2">
            {dropdownOpen ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800">
                    <div className="p-3">
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('goals.searchGoals', 'Search goals…')}
                            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                            {selectedGoal && (
                                <button
                                    onClick={handleClear}
                                    className="w-full text-left text-sm px-3 py-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                    {t('goals.clearGoal', 'Remove goal')}
                                </button>
                            )}
                            {activeGoals.length === 0 && inactiveGoals.length === 0 ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500 px-3 py-2">
                                    {t('goals.noGoalsFound', 'No goals found')}
                                </div>
                            ) : (
                                <>
                                    {activeGoals.map((goal) => (
                                        <button
                                            key={goal.id}
                                            onClick={() => handleSelect(goal)}
                                            className="w-full text-left text-sm px-3 py-1.5 rounded text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                        >
                                            <FlagIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                            {goal.title}
                                        </button>
                                    ))}
                                    {inactiveGoals.length > 0 && (
                                        <>
                                            <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 mt-1">
                                                {t('goals.inactive', 'Inactive')}
                                            </div>
                                            {inactiveGoals.map((goal) => (
                                                <button
                                                    key={goal.id}
                                                    onClick={() => handleSelect(goal)}
                                                    className="w-full text-left text-sm px-3 py-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                                >
                                                    <FlagIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                                    {goal.title} ({goal.status})
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : selectedGoal ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div
                            className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                            onClick={() => setDropdownOpen(true)}
                        >
                            <FlagIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {selectedGoal.title}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {selectedGoal.uid && (
                                <Link
                                    to={createGoalUrl({ uid: selectedGoal.uid, title: selectedGoal.title })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title={t('goals.viewGoal', 'Go to goal')}
                                >
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            )}
                            <button
                                onClick={handleClear}
                                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title={t('goals.clearGoal', 'Remove goal')}
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setDropdownOpen(true)}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <FlagIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t('task.noGoal', 'Assign to a goal')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskGoalCard;
