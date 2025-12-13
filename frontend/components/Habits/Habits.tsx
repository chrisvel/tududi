import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Task } from '../../entities/Task';
import HabitCard from './HabitCard';
import {
    PlusIcon,
    FireIcon,
    CheckCircleIcon,
    ChartBarIcon,
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
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <PlusIcon className="w-5 h-5" />
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
                        {/* Dashboard */}
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold dark:text-white mb-4 flex items-center gap-2">
                                <ChartBarIcon className="h-6 w-6" />
                                {t('habits.overview', 'Overview')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Total Habits */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {t(
                                                'habits.totalHabits',
                                                'Total Habits'
                                            )}
                                        </h3>
                                        <FireIcon className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {dashboardStats.totalHabits}
                                    </p>
                                </div>

                                {/* Active Streaks */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {t(
                                                'habits.activeStreaks',
                                                'Active Streaks'
                                            )}
                                        </h3>
                                        <FireIcon className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {dashboardStats.activeStreaks}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('habits.total', 'Total')}:{' '}
                                        {dashboardStats.totalCurrentStreak}{' '}
                                        {t('habits.days', 'days')}
                                    </p>
                                </div>

                                {/* Best Streak */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {t(
                                                'habits.bestStreak',
                                                'Best Streak'
                                            )}
                                        </h3>
                                        <FireIcon className="h-5 w-5 text-yellow-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {dashboardStats.totalBestStreak}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('habits.days', 'days')}
                                    </p>
                                </div>

                                {/* Total Completions */}
                                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {t(
                                                'habits.totalCompletions',
                                                'Total Completions'
                                            )}
                                        </h3>
                                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {dashboardStats.totalCompletions}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('habits.allTime', 'all time')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Habits Grid */}
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white mb-4">
                                {t('habits.yourHabits', 'Your Habits')}
                            </h2>
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
