import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    EllipsisVerticalIcon,
    FlagIcon,
    FolderIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import GoalModal from './Goal/GoalModal';
import { useStore } from '../store/useStore';
import { createGoal, updateGoal, deleteGoal } from '../utils/goalsService';
import { Goal } from '../entities/Goal';
import { createGoalUrl } from '../utils/slugUtils';

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const Goals: React.FC = () => {
    const { t } = useTranslation();

    const {
        goals,
        isLoading: loading,
        hasLoaded,
        loadGoals,
    } = useStore((state: any) => state.goalsStore);

    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasLoaded && !loading) loadGoals();
    }, [hasLoaded, loading, loadGoals]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (justOpenedRef.current) { justOpenedRef.current = false; return; }
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(null);
            }
        };
        if (dropdownOpen !== null) {
            const id = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
            return () => { clearTimeout(id); document.removeEventListener('mousedown', handleClickOutside); };
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const handleSaveGoal = async (data: Partial<Goal>) => {
        if (selectedGoal?.uid) {
            const result = await updateGoal(selectedGoal.uid, data);
            const current = useStore.getState().goalsStore.goals;
            useStore.getState().goalsStore.setGoals(
                current.map((g: Goal) => (g.uid === result.goal.uid ? result.goal : g))
            );
        } else {
            const result = await createGoal(data as any);
            const current = useStore.getState().goalsStore.goals;
            useStore.getState().goalsStore.setGoals([...current, result.goal]);
        }
        setIsGoalModalOpen(false);
        setSelectedGoal(null);
    };

    const handleDeleteGoal = async () => {
        if (!goalToDelete?.uid) return;
        await deleteGoal(goalToDelete.uid);
        const current = useStore.getState().goalsStore.goals;
        useStore.getState().goalsStore.setGoals(current.filter((g: Goal) => g.uid !== goalToDelete.uid));
        setIsConfirmDialogOpen(false);
        setGoalToDelete(null);
    };

    const openEdit = (goal: Goal) => { setSelectedGoal(goal); setIsGoalModalOpen(true); };
    const openConfirmDelete = (goal: Goal) => { setGoalToDelete(goal); setIsConfirmDialogOpen(true); };

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">{t('goals.title', 'Goals')}</h2>
                </div>

                {goals.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('goals.noGoalsFound', 'No goals yet.')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {goals.map((goal: Goal) => {
                            const goalUrl = goal.uid ? createGoalUrl({ uid: goal.uid, title: goal.title }) : '/goals';
                            return (
                                <Link
                                    key={goal.uid}
                                    to={goalUrl}
                                    className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 ${dropdownOpen === goal.uid ? 'z-50' : ''}`}
                                >
                                    {/* Three-dot menu */}
                                    <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const next = dropdownOpen === goal.uid ? null : goal.uid!;
                                                if (next) justOpenedRef.current = true;
                                                setDropdownOpen(next);
                                            }}
                                            className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        >
                                            <EllipsisVerticalIcon className="h-4 w-4" />
                                        </button>
                                        {dropdownOpen === goal.uid && (
                                            <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(goal); setDropdownOpen(null); }}
                                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                                >
                                                    {t('common.edit', 'Edit')}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openConfirmDelete(goal); setDropdownOpen(null); }}
                                                    className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                                >
                                                    {t('common.delete', 'Delete')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Card content */}
                                    <div className="px-5 pt-6 pb-4 flex-1 flex flex-col">
                                        <div className="flex items-start gap-2 mb-2">
                                            <FlagIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
                                                {goal.title}
                                            </h3>
                                        </div>
                                        {goal.why && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                                {goal.why}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1 mt-auto">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[goal.status] ?? ''}`}>
                                                {t(`goals.status.${goal.status}`, goal.status)}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                {t(`goals.horizon.${goal.horizon}`, goal.horizon)}
                                            </span>
                                        </div>
                                        {goal.Area && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                                {goal.Area.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Stats footer */}
                                    <div className="rounded-b-xl flex items-stretch divide-x bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600">
                                        {[
                                            {
                                                icon: <FolderIcon className="h-3.5 w-3.5" />,
                                                count: (goal as any).projects_count ?? (goal.Projects?.length ?? 0),
                                                label: t('goals.stats.projects', 'projects'),
                                            },
                                            {
                                                icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
                                                count: (goal as any).tasks_count ?? (goal.Tasks?.length ?? 0),
                                                label: t('goals.stats.tasks', 'tasks'),
                                            },
                                        ].map(({ icon, count, label }) => (
                                            <div key={label} className="flex-1 flex flex-col items-center py-3 gap-1">
                                                <span className="text-base font-semibold leading-none text-gray-700 dark:text-gray-200">
                                                    {count}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] leading-none text-gray-400 dark:text-gray-500">
                                                    {icon}
                                                    {label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {isGoalModalOpen && (
                <GoalModal
                    isOpen={isGoalModalOpen}
                    onClose={() => { setIsGoalModalOpen(false); setSelectedGoal(null); }}
                    onSave={handleSaveGoal}
                    onDelete={async (uid) => { await deleteGoal(uid); loadGoals(true); setIsGoalModalOpen(false); setSelectedGoal(null); }}
                    goal={selectedGoal}
                />
            )}

            {isConfirmDialogOpen && goalToDelete && (
                <ConfirmDialog
                    title={t('modals.deleteGoal.title', 'Delete Goal')}
                    message={`${t('modals.deleteGoal.message', 'Are you sure you want to delete the goal')} "${goalToDelete.title}"?`}
                    onConfirm={handleDeleteGoal}
                    onCancel={() => { setIsConfirmDialogOpen(false); setGoalToDelete(null); }}
                />
            )}
        </div>
    );
};

export default Goals;
