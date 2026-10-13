import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeftIcon,
    ArchiveBoxIcon,
    ArrowUturnLeftIcon,
    TrashIcon,
    FireIcon,
    TrophyIcon,
    BoltIcon,
    CheckCircleIcon,
    NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    deleteHabit,
    deleteHabitCompletion,
    fetchHabit,
    fetchHabitCompletions,
    HabitCompletion,
    logHabitCompletion,
    setHabitArchived,
    skipHabitDay,
    updateHabit,
    updateHabitCompletion,
} from '../../utils/habitsService';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';
import {
    formatAmount,
    formatHabitTarget,
    habitAccentStyle,
    isQuitHabit,
    periodNoun,
    toDayKey,
    totalsByDay,
} from '../../utils/habitUtils';
import { useStore } from '../../store/useStore';
import HabitSettings, {
    HabitSettingsValues,
    settingsFromHabit,
} from './HabitSettings';
import HabitHeatmap from './HabitHeatmap';
import HabitDayPanel from './HabitDayPanel';
import HabitCheckIn from './HabitCheckIn';
import HabitProgressBar from './HabitProgressBar';
import { ACCENT, SURFACE } from '../../constants/colorPalette';

const HabitDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const updateHabitInList = useStore(
        (state) => state.habitsStore.updateHabitInList
    );

    const [habit, setHabit] = useState<Task | null>(null);
    const [name, setName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [completions, setCompletions] = useState<HabitCompletion[]>([]);
    const [loadingYear, setLoadingYear] = useState(false);
    const [selected, setSelected] = useState<Date>(new Date());

    const applyHabit = useCallback(
        (next: Task) => {
            setHabit(next);
            updateHabitInList(next);
        },
        [updateHabitInList]
    );

    useEffect(() => {
        getFirstDayOfWeek()
            .then(setFirstDayOfWeek)
            .catch(() =>
                setFirstDayOfWeek(getLocaleFirstDayOfWeek(navigator.language))
            );
    }, []);

    useEffect(() => {
        if (!uid) return;
        fetchHabit(uid)
            .then((found) => {
                setHabit(found);
                setName(found.name);
            })
            .catch(() => navigate('/habits'));
    }, [uid, navigate]);

    const loadYear = useCallback(async () => {
        if (!uid) return;
        setLoadingYear(true);
        try {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31, 23, 59, 59, 999);
            setCompletions(await fetchHabitCompletions(uid, start, end));
        } catch (err) {
            console.error('Failed to load completions:', err);
        } finally {
            setLoadingYear(false);
        }
    }, [uid, year]);

    useEffect(() => {
        loadYear();
    }, [loadYear]);

    const totals = useMemo(
        () => (habit ? totalsByDay(habit, completions) : new Map()),
        [habit, completions]
    );

    // Back-filled history can start before the habit was created.
    const firstDay = habit?.habit_progress?.first_day;
    const minYear = firstDay
        ? parseInt(firstDay.slice(0, 4), 10)
        : new Date().getFullYear();

    const run = async (fn: () => Promise<{ task: Task } | void>) => {
        setError(null);
        try {
            const result = await fn();
            if (result && result.task) applyHabit(result.task);
            await loadYear();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const selectedDate = () => {
        const date = new Date(selected);
        const now = new Date();
        // Today keeps the real time; past days are logged at noon.
        if (toDayKey(date) === toDayKey(now)) return now;
        date.setHours(12, 0, 0, 0);
        return date;
    };

    const saveSettings = async (patch: Partial<HabitSettingsValues>) => {
        if (!habit?.uid) return;
        setSaving(true);
        setError(null);
        try {
            applyHabit(await updateHabit(habit.uid, patch));
            await loadYear();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    const saveName = async () => {
        const trimmed = name.trim();
        setEditingName(false);
        if (!habit?.uid || !trimmed || trimmed === habit.name) {
            setName(habit?.name || '');
            return;
        }
        try {
            applyHabit(await updateHabit(habit.uid, { name: trimmed }));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleDelete = async () => {
        if (!habit?.uid) return;
        if (
            !confirm(
                t(
                    'habits.confirmDelete',
                    'Delete this habit and its whole history? Archive it instead to keep the history.'
                )
            )
        ) {
            return;
        }
        try {
            await deleteHabit(habit.uid);
            navigate('/habits');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleArchive = async () => {
        if (!habit?.uid) return;
        try {
            applyHabit(
                await setHabitArchived(habit.uid, !habit.habit_archived)
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    if (!habit) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-600 dark:text-gray-400">
                {t('common.loading', 'Loading...')}
            </div>
        );
    }

    const quit = isQuitHabit(habit);
    const streak = habit.habit_current_streak || 0;
    const selectedKey = toDayKey(selected);
    const yearCheckIns = completions.filter((c) => !c.skipped);
    const yearAmount = yearCheckIns.reduce(
        (sum, c) => sum + (Number(c.value) || 0),
        0
    );

    const stats = [
        {
            label: quit
                ? t('habits.cleanStreak', 'Clean streak')
                : t('habits.currentStreak', 'Current streak'),
            value: streak,
            sub: periodNoun(t, habit, streak),
            icon: <FireIcon className="h-5 w-5 text-orange-500" />,
        },
        {
            label: t('habits.bestStreak', 'Best streak'),
            value: habit.habit_best_streak || 0,
            sub: periodNoun(t, habit, habit.habit_best_streak || 0),
            icon: <TrophyIcon className="h-5 w-5 text-amber-500" />,
        },
        {
            label: t('habits.strength', 'Strength'),
            value: `${Math.round(habit.habit_strength || 0)}%`,
            sub: t(
                'habits.strengthExplain',
                'Missing a day dents it, it does not reset'
            ),
            icon: <BoltIcon className="h-5 w-5 text-blue-500" />,
        },
        {
            label: quit
                ? t('habits.slipsThisYear', 'Slips in {{year}}', { year })
                : t('habits.checkInsThisYear', 'Check-ins in {{year}}', {
                      year,
                  }),
            value: yearCheckIns.length,
            sub:
                yearAmount > 0 && habit.habit_unit
                    ? `${formatAmount(yearAmount)} ${habit.habit_unit}`
                    : t('habits.allTimeCount', '{{count}} all time', {
                          count: habit.habit_total_completions || 0,
                      }),
            icon: quit ? (
                <NoSymbolIcon className="h-5 w-5 text-red-500" />
            ) : (
                <CheckCircleIcon className={`h-5 w-5 ${ACCENT.text}`} />
            ),
        },
    ];

    return (
        <div
            className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12"
            style={habitAccentStyle(habit)}
        >
            <button
                onClick={() => navigate('/habits')}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                {t('habits.backToHabits', 'Habits')}
            </button>

            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-0">
                    {editingName ? (
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={saveName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Escape') {
                                    setName(habit.name);
                                    setEditingName(false);
                                }
                            }}
                            className="w-full bg-transparent text-3xl font-bold text-gray-900 dark:text-white focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
                            placeholder={t(
                                'habits.namePlaceholder',
                                'e.g. Read 20 pages, No sugar'
                            )}
                            aria-label={t('habits.name', 'Habit name')}
                        />
                    ) : (
                        <button
                            type="button"
                            className="text-left text-3xl font-bold text-gray-900 dark:text-white break-words hover:text-gray-700 dark:hover:text-gray-300"
                            onClick={() => setEditingName(true)}
                        >
                            {habit.name}
                        </button>
                    )}
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatHabitTarget(t, habit)}
                        {habit.habit_archived &&
                            ` · ${t('habits.archivedLabel', 'Archived')}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <>
                        {!habit.habit_archived && (
                            <HabitCheckIn
                                habit={habit}
                                size="lg"
                                onCheckIn={(options) =>
                                    run(() =>
                                        logHabitCompletion(
                                            habit.uid!,
                                            undefined,
                                            options
                                        )
                                    )
                                }
                            />
                        )}
                        <button
                            onClick={handleArchive}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            {habit.habit_archived ? (
                                <ArrowUturnLeftIcon className="h-4 w-4" />
                            ) : (
                                <ArchiveBoxIcon className="h-4 w-4" />
                            )}
                            {habit.habit_archived
                                ? t('habits.restore', 'Restore')
                                : t('habits.archive', 'Archive')}
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title={t('common.delete', 'Delete')}
                            aria-label={t('common.delete', 'Delete')}
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </>
                </div>
            </div>

            {error && (
                <div
                    role="alert"
                    className="mb-4 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
                >
                    {error}
                </div>
            )}

            {!quit && habit.habit_progress && (
                <div className="mb-6 max-w-md">
                    <HabitProgressBar habit={habit} />
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                <div
                    className={`lg:w-80 shrink-0 ${SURFACE.card} rounded-xl shadow-sm p-5 h-fit`}
                >
                    <HabitSettings
                        values={settingsFromHabit(habit)}
                        firstDayOfWeek={firstDayOfWeek}
                        onChange={saveSettings}
                        saving={saving}
                    />
                </div>

                <div className="flex-1 min-w-0 space-y-6">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        {stats.map(({ label, value, sub, icon }) => (
                            <div
                                key={label}
                                className={`${SURFACE.card} rounded-xl shadow-sm p-4 min-w-0`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                        {label}
                                    </h3>
                                    {icon}
                                </div>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                                    {value}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                                    {sub}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div
                        className={`${SURFACE.card} rounded-xl shadow-sm p-5 space-y-4`}
                    >
                        <HabitHeatmap
                            habit={habit}
                            year={year}
                            minYear={minYear}
                            totals={totals}
                            firstDayOfWeek={firstDayOfWeek}
                            selectedKey={selectedKey}
                            loading={loadingYear && completions.length === 0}
                            onSelect={setSelected}
                            onYearChange={(next) => {
                                setYear(next);
                                setSelected(
                                    next === new Date().getFullYear()
                                        ? new Date()
                                        : new Date(next, 11, 31)
                                );
                            }}
                        />
                        {toDayKey(selected).startsWith(String(year)) && (
                            <HabitDayPanel
                                habit={habit}
                                date={selected}
                                totals={totals.get(selectedKey)}
                                onCheckIn={(options) =>
                                    run(() =>
                                        logHabitCompletion(
                                            habit.uid!,
                                            selectedDate(),
                                            options
                                        )
                                    )
                                }
                                onSkip={() =>
                                    run(() =>
                                        skipHabitDay(habit.uid!, selectedDate())
                                    )
                                }
                                onDelete={(entry) =>
                                    run(() =>
                                        deleteHabitCompletion(
                                            habit.uid!,
                                            entry.id
                                        )
                                    )
                                }
                                onUpdateNote={(entry, note) =>
                                    run(() =>
                                        updateHabitCompletion(
                                            habit.uid!,
                                            entry.id,
                                            { note }
                                        )
                                    )
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HabitDetails;
