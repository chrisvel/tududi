import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    EllipsisVerticalIcon,
    FlagIcon,
    FolderIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import { useStore } from '../store/useStore';
import { deleteGoal } from '../utils/goalsService';
import { Goal } from '../entities/Goal';
import { Area } from '../entities/Area';
import { createGoalUrl } from '../utils/slugUtils';

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const Goals: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const {
        goals,
        isLoading: loading,
        hasLoaded,
        loadGoals,
    } = useStore((state: any) => state.goalsStore);

    const areas: Area[] = useStore((state: any) => state.areasStore.areas);
    const areasLoaded = useStore((state: any) => state.areasStore.hasLoaded);
    const loadAreas = useStore((state: any) => state.areasStore.loadAreas);

    const [selectedAreaUid, setSelectedAreaUid] = useState<string | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasLoaded && !loading) loadGoals();
    }, [hasLoaded, loading, loadGoals]);

    useEffect(() => {
        if (!areasLoaded) loadAreas();
    }, [areasLoaded, loadAreas]);

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

    const handleDeleteGoal = async () => {
        if (!goalToDelete?.uid) return;
        await deleteGoal(goalToDelete.uid);
        const current = useStore.getState().goalsStore.goals;
        useStore.getState().goalsStore.setGoals(current.filter((g: Goal) => g.uid !== goalToDelete.uid));
        setIsConfirmDialogOpen(false);
        setGoalToDelete(null);
    };

    const openConfirmDelete = (goal: Goal) => { setGoalToDelete(goal); setIsConfirmDialogOpen(true); };

    // Derive areas that actually have goals
    const areasWithGoals = areas.filter((a) =>
        goals.some((g: Goal) => g.area_id === a.id || (g.Area && g.Area.uid === a.uid))
    );

    const filteredGoals = selectedAreaUid
        ? goals.filter((g: Goal) => g.Area?.uid === selectedAreaUid)
        : goals;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center mb-6">
                    <h2 className="text-2xl font-light">{t('goals.title', 'Goals')}</h2>
                </div>

                {/* Area filter tabs */}
                {areasWithGoals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        <button
                            onClick={() => setSelectedAreaUid(null)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                selectedAreaUid === null
                                    ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {t('common.all', 'All')}
                        </button>
                        {areasWithGoals.map((area) => (
                            <button
                                key={area.uid}
                                onClick={() => setSelectedAreaUid(area.uid === selectedAreaUid ? null : area.uid!)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    selectedAreaUid === area.uid
                                        ? 'text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                                style={
                                    selectedAreaUid === area.uid && area.color
                                        ? { backgroundColor: area.color }
                                        : selectedAreaUid === area.uid
                                        ? { backgroundColor: '#374151' }
                                        : {}
                                }
                            >
                                {area.name}
                            </button>
                        ))}
                    </div>
                )}

                {filteredGoals.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('goals.noGoalsFound', 'No goals yet.')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredGoals.map((goal: Goal) => {
                            const goalUrl = goal.uid ? createGoalUrl({ uid: goal.uid, title: goal.title }) : '/goals';
                            const areaColor = goal.Area?.color;
                            const hasColor = !!areaColor;

                            return (
                                <Link
                                    key={goal.uid}
                                    to={goalUrl}
                                    className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer ${
                                        !hasColor
                                            ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                            : ''
                                    } ${dropdownOpen === goal.uid ? 'z-50' : ''}`}
                                    style={hasColor ? { backgroundColor: areaColor } : {}}
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
                                            className={`focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded ${
                                                hasColor
                                                    ? 'text-white/60 hover:text-white hover:bg-white/20'
                                                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            <EllipsisVerticalIcon className="h-4 w-4" />
                                        </button>
                                        {dropdownOpen === goal.uid && (
                                            <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setDropdownOpen(null);
                                                        navigate(goalUrl);
                                                    }}
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
                                    <div className="px-5 pt-6 pb-4 flex-1 flex items-center justify-center text-center">
                                        <div>
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <FlagIcon className={`h-4 w-4 flex-shrink-0 ${hasColor ? 'text-white/70' : 'text-blue-500'}`} />
                                            </div>
                                            <h3 className={`text-sm font-semibold tracking-wide line-clamp-2 ${
                                                hasColor ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                                            }`}>
                                                {goal.title}
                                            </h3>
                                            {goal.why && (
                                                <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${
                                                    hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    {goal.why}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap justify-center gap-1 mt-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    hasColor
                                                        ? 'bg-white/20 text-white'
                                                        : STATUS_COLORS[goal.status] ?? ''
                                                }`}>
                                                    {t(`goals.status.${goal.status}`, goal.status)}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    hasColor
                                                        ? 'bg-white/15 text-white/80'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                    {t(`goals.horizon.${goal.horizon}`, goal.horizon)}
                                                </span>
                                            </div>
                                            {goal.Area && (
                                                <p className={`text-xs mt-2 ${hasColor ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {goal.Area.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats footer */}
                                    <div className={`rounded-b-xl flex items-stretch divide-x ${
                                        hasColor
                                            ? 'bg-black/20 divide-white/10'
                                            : 'bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600'
                                    }`}>
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
                                                <span className={`text-base font-semibold leading-none ${
                                                    hasColor ? 'text-white' : 'text-gray-700 dark:text-gray-200'
                                                }`}>
                                                    {count}
                                                </span>
                                                <span className={`flex items-center gap-1 text-[10px] leading-none ${
                                                    hasColor ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'
                                                }`}>
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
