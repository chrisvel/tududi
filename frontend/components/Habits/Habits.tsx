import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Task } from '../../entities/Task';
import HabitCard from './HabitCard';
import {
    FireIcon,
    CheckCircleIcon,
    ChartBarIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const Habits: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { habits, isLoading, loadHabits, logCompletion } = useStore(
        (state) => state.habitsStore
    );

    useEffect(() => {
        loadHabits();
    }, [loadHabits]);

    const handleCreateHabit = () => {
        navigate('/habit/new');
    };

    const handleViewHabit = (habit: Task) => {
        if (habit.uid) {
            navigate(`/habit/${habit.uid}`);
        }
    };

    const handleComplete = async (habitUid: string) => {
        try {
            await logCompletion(habitUid);
        } catch (error) {
            console.error('Failed to log completion:', error);
        }
    };

    // Calculate dashboard statistics
    const dashboardStats = useMemo(() => {
        const totalHabits = habits.length;
        const totalCompletions = habits.reduce(
            (sum, h) => sum + (h.habit_total_completions || 0),
            0
        );
        const totalCurrentStreak = habits.reduce(
            (sum, h) => sum + (h.habit_current_streak || 0),
            0
        );
        const totalBestStreak = habits.reduce(
            (max, h) => Math.max(max, h.habit_best_streak || 0),
            0
        );
        const activeStreaks = habits.filter(
            (h) => (h.habit_current_streak || 0) > 0
        ).length;

        return {
            totalHabits,
            totalCompletions,
            totalCurrentStreak,
            totalBestStreak,
            activeStreaks,
        };
    }, [habits]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg dark:text-white">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full pt-4 pb-8 px-2 sm:px-4 lg:px-6">
            <div className="w-full">
                <div className="flex items-center justify-between gap-2 mb-8">
                    <h2 className="text-2xl font-light dark:text-white">
                        {t('habits.title', 'Habits')}
                    </h2>
                    <button
                        onClick={handleCreateHabit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
                    >
                        <PlusIcon className="w-4 h-4" />
                        {t('habits.new', 'New Habit')}
                    </button>
                </div>

                {habits.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>
                            {t(
                                'habits.empty',
                                'No habits yet. Create your first habit to get started!'
                            )}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Overview */}
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">
                                {t('habits.overview', 'Overview')}
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    {
                                        label: t('habits.totalHabits', 'Total Habits'),
                                        value: dashboardStats.totalHabits,
                                        icon: <FireIcon className="h-4 w-4" />,
                                        sub: null,
                                    },
                                    {
                                        label: t('habits.activeStreaks', 'Active Streaks'),
                                        value: dashboardStats.activeStreaks,
                                        icon: <FireIcon className="h-4 w-4" />,
                                        sub: `${dashboardStats.totalCurrentStreak} ${t('habits.days', 'days')} total`,
                                    },
                                    {
                                        label: t('habits.bestStreak', 'Best Streak'),
                                        value: dashboardStats.totalBestStreak,
                                        icon: <ChartBarIcon className="h-4 w-4" />,
                                        sub: t('habits.days', 'days'),
                                    },
                                    {
                                        label: t('habits.totalCompletions', 'Total Completions'),
                                        value: dashboardStats.totalCompletions,
                                        icon: <CheckCircleIcon className="h-4 w-4" />,
                                        sub: t('habits.allTime', 'all time'),
                                    },
                                ].map(({ label, value, icon, sub }) => (
                                    <div
                                        key={label}
                                        className="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 px-4 pt-4 pb-3"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                {label}
                                            </span>
                                            <span className="text-gray-300 dark:text-gray-500">
                                                {icon}
                                            </span>
                                        </div>
                                        <p className="text-3xl font-semibold text-gray-800 dark:text-gray-100 leading-none">
                                            {value}
                                        </p>
                                        {sub && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                                {sub}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Habits Grid */}
                        <div>
                            <h3 className="text-sm font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">
                                {t('habits.yourHabits', 'Your Habits')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {habits.map((habit) => (
                                    <HabitCard
                                        key={habit.uid}
                                        habit={habit}
                                        onComplete={handleComplete}
                                        onEdit={handleViewHabit}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Habits;
