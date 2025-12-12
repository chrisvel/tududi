import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { CheckCircleIcon, FireIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Compact widget for Today view showing today's habits
 */
const HabitsTodayWidget: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { habits, loadHabits, logCompletion } = useStore(
        (state) => state.habitsStore
    );

    useEffect(() => {
        loadHabits();
    }, [loadHabits]);

    const habitsForToday = habits.filter((h) => h.status !== 3); // Not archived

    if (habitsForToday.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-orange-500" />
                    {t('habits.title', 'Habits')}
                </h3>
                <button
                    onClick={() => navigate('/habits')}
                    className="text-sm text-blue-600 hover:underline"
                >
                    {t('common.viewAll', 'View all')}
                </button>
            </div>

            <div className="space-y-2">
                {habitsForToday.slice(0, 5).map((habit) => (
                    <div
                        key={habit.uid}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <button
                                onClick={() => logCompletion(habit.uid!)}
                                className="text-green-600 hover:text-green-700 transition"
                                title="Complete habit"
                            >
                                <CheckCircleIcon className="w-6 h-6" />
                            </button>
                            <span className="dark:text-white">
                                {habit.name}
                            </span>
                        </div>
                        {habit.habit_current_streak !== undefined &&
                            habit.habit_current_streak > 0 && (
                                <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
                                    <FireIcon className="w-4 h-4" />
                                    {habit.habit_current_streak}
                                </span>
                            )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HabitsTodayWidget;
