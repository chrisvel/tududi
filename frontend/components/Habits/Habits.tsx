import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Task, HabitTimeOfDay } from '../../entities/Task';
import HabitCard from './HabitCard';
import { SURFACE } from '../../constants/colorPalette';
import {
    FireIcon,
    CheckCircleIcon,
    BoltIcon,
    TrophyIcon,
    PlusIcon,
    ArchiveBoxIcon,
    ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { fetchHabits, setHabitArchived } from '../../utils/habitsService';
import {
    TIMES_OF_DAY,
    formatHabitTarget,
    isHabitCompletedInPeriod,
    isQuitHabit,
} from '../../utils/habitUtils';

type Group = HabitTimeOfDay | 'anytime';

const Habits: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { habits, isLoading, loadHabits, logCompletion } = useStore(
        (state) => state.habitsStore
    );
    const [showArchived, setShowArchived] = useState(false);
    const [archived, setArchived] = useState<Task[]>([]);

    useEffect(() => {
        loadHabits();
    }, [loadHabits]);

    useEffect(() => {
        if (!showArchived) return;
        fetchHabits(true)
            .then(setArchived)
            .catch((error) =>
                console.error('Failed to load archived habits:', error)
            );
    }, [showArchived]);

    const openHabit = (habit: Task) => {
        if (habit.uid) navigate(`/habit/${habit.uid}`);
    };

    const handleCheckIn = async (habit: Task, options?: { value?: number }) => {
        try {
            await logCompletion(habit.uid!, undefined, options);
        } catch (error) {
            console.error('Failed to log completion:', error);
        }
    };

    const handleRestore = async (habit: Task) => {
        try {
            await setHabitArchived(habit.uid!, false);
            setArchived((prev) => prev.filter((h) => h.uid !== habit.uid));
            loadHabits();
        } catch (error) {
            console.error('Failed to restore habit:', error);
        }
    };

    const stats = useMemo(() => {
        const building = habits.filter((h) => !isQuitHabit(h));
        const doneNow = building.filter((h) =>
            isHabitCompletedInPeriod(h)
        ).length;
        const strength =
            habits.length > 0
                ? Math.round(
                      habits.reduce(
                          (sum, h) => sum + (h.habit_strength || 0),
                          0
                      ) / habits.length
                  )
                : 0;
        const activeStreaks = habits.filter(
            (h) => (h.habit_current_streak || 0) > 0
        ).length;
        let best: Task | null = null;
        for (const h of habits as Task[]) {
            if (
                !best ||
                (h.habit_best_streak || 0) > (best.habit_best_streak || 0)
            ) {
                best = h;
            }
        }
        return { building, doneNow, strength, activeStreaks, best };
    }, [habits]);

    const groups = useMemo(() => {
        const order: Group[] = [...TIMES_OF_DAY, 'anytime'];
        return order
            .map((group) => ({
                group,
                items: habits.filter(
                    (h) => (h.habit_time_of_day || 'anytime') === group
                ),
            }))
            .filter(({ items }) => items.length > 0);
    }, [habits]);

    const groupLabel = (group: Group) =>
        ({
            morning: t('habits.timeOfDay.morning', 'Morning'),
            afternoon: t('habits.timeOfDay.afternoon', 'Afternoon'),
            evening: t('habits.timeOfDay.evening', 'Evening'),
            anytime: t('habits.timeOfDay.anytime', 'Anytime'),
        })[group];

    if (isLoading && habits.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg dark:text-white">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    const overview = [
        {
            label: t('habits.doneNow', 'Done for now'),
            value: `${stats.doneNow}/${stats.building.length}`,
            icon: <CheckCircleIcon className="h-4 w-4" />,
            sub: t('habits.doneNowHint', 'habits with their goal met'),
        },
        {
            label: t('habits.activeStreaks', 'Active Streaks'),
            value: stats.activeStreaks,
            icon: <FireIcon className="h-4 w-4" />,
            sub: t('habits.ofHabits', 'of {{count}} habits', {
                count: habits.length,
            }),
        },
        {
            label: t('habits.avgStrength', 'Average Strength'),
            value: `${stats.strength}%`,
            icon: <BoltIcon className="h-4 w-4" />,
            sub: t('habits.strengthHint', 'rises with repetition'),
        },
        {
            label: t('habits.bestStreak', 'Best Streak'),
            value: stats.best?.habit_best_streak || 0,
            icon: <TrophyIcon className="h-4 w-4" />,
            sub: stats.best?.habit_best_streak ? stats.best.name : null,
        },
    ];

    // Grouping headers only help once some habit has a time of day.
    const showGroupHeaders = groups.some(({ group }) => group !== 'anytime');

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="flex items-center justify-between gap-2 mb-8">
                <h2 className="text-2xl font-light dark:text-white">
                    {t('habits.title', 'Habits')}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowArchived((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            showArchived
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        <ArchiveBoxIcon className="w-4 h-4" />
                        {t('habits.archived', 'Archived')}
                    </button>
                    <button
                        onClick={() => navigate('/habit/new')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${SURFACE.card} text-gray-700 dark:text-gray-300 rounded-lg shadow-sm hover:shadow transition-all`}
                    >
                        <PlusIcon className="w-4 h-4" />
                        {t('habits.new', 'New Habit')}
                    </button>
                </div>
            </div>

            {showArchived && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-3">
                        {t('habits.archived', 'Archived')}
                    </h3>
                    {archived.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('habits.noArchived', 'No archived habits.')}
                        </p>
                    ) : (
                        <ul
                            className={`rounded-xl ${SURFACE.card} shadow-sm divide-y divide-gray-100 dark:divide-gray-600/40`}
                        >
                            {archived.map((habit) => (
                                <li
                                    key={habit.uid}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <button
                                        type="button"
                                        onClick={() => openHabit(habit)}
                                        className="min-w-0 text-left"
                                    >
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                            {habit.name}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {formatHabitTarget(t, habit)} ·{' '}
                                            {t(
                                                'habits.bestStreakShort',
                                                'best {{count}}',
                                                {
                                                    count:
                                                        habit.habit_best_streak ||
                                                        0,
                                                }
                                            )}
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRestore(habit)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                        {t('habits.restore', 'Restore')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

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
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">
                            {t('habits.overview', 'Overview')}
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {overview.map(({ label, value, icon, sub }) => (
                                <div
                                    key={label}
                                    className={`${SURFACE.card} rounded-xl shadow-sm px-4 pt-4 pb-3 min-w-0`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {label}
                                        </span>
                                        <span className="text-gray-300 dark:text-gray-500">
                                            {icon}
                                        </span>
                                    </div>
                                    <p className="text-3xl font-semibold text-gray-800 dark:text-gray-100 leading-none tabular-nums">
                                        {value}
                                    </p>
                                    {sub && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">
                                            {sub}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {groups.map(({ group, items }) => (
                        <div key={group} className="mb-8">
                            <h3 className="text-sm font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">
                                {showGroupHeaders
                                    ? groupLabel(group)
                                    : t('habits.yourHabits', 'Your Habits')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map((habit) => (
                                    <HabitCard
                                        key={habit.uid}
                                        habit={habit}
                                        onCheckIn={handleCheckIn}
                                        onOpen={openHabit}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default Habits;
