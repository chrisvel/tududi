import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task } from '../../entities/Task';
import {
    fetchHabits,
    fetchHabitCompletions,
    deleteHabitCompletion,
    logHabitCompletion,
    updateHabit,
    createHabit,
    deleteHabit,
    HabitCompletion,
} from '../../utils/habitsService';
import {
    FireIcon,
    ArrowLeftIcon,
    CheckCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const mapHabitToEditableValues = (task: Task) => ({
    name: task.name || '',
    habit_target_count: task.habit_target_count || 1,
    habit_frequency_period:
        (task.habit_frequency_period as 'daily' | 'weekly' | 'monthly') ||
        'daily',
    habit_flexibility_mode:
        (task.habit_flexibility_mode as 'flexible' | 'strict') || 'flexible',
    habit_streak_mode:
        (task.habit_streak_mode as 'calendar' | 'scheduled') || 'calendar',
});

const HabitDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    type EditableField = 'name' | 'targetFrequency' | 'flexibility' | 'streak';

    const [habit, setHabit] = useState<Task | null>(null);
    const [completions, setCompletions] = useState<HabitCompletion[]>([]);
    const [loading, setLoading] = useState(true);
    const [editableValues, setEditableValues] = useState({
        name: '',
        habit_target_count: 1,
        habit_frequency_period: 'daily' as 'daily' | 'weekly' | 'monthly',
        habit_flexibility_mode: 'flexible' as 'flexible' | 'strict',
        habit_streak_mode: 'calendar' as 'calendar' | 'scheduled',
    });
    const [editingField, setEditingField] = useState<EditableField | null>(
        null
    );
    const [savingField, setSavingField] = useState<EditableField | null>(null);
    const HISTORY_DAYS = 90;
    const DAYS_PER_CALENDAR = 30;
    const editingFieldRef = useRef<EditableField | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const targetFrequencyContainerRef = useRef<HTMLDivElement | null>(null);
    const targetCountInputRef = useRef<HTMLInputElement | null>(null);
    const flexibilityContainerRef = useRef<HTMLDivElement | null>(null);
    const flexibilitySelectRef = useRef<HTMLSelectElement | null>(null);
    const streakContainerRef = useRef<HTMLDivElement | null>(null);
    const streakSelectRef = useRef<HTMLSelectElement | null>(null);

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const completionCountMap = useMemo(() => {
        const map = new Map<string, number>();
        completions.forEach((completion) => {
            const key = formatDateKey(new Date(completion.completed_at));
            map.set(key, (map.get(key) || 0) + 1);
        });
        return map;
    }, [completions]);

    const baseChartData = useMemo(() => {
        const days = 14;
        const data: { date: string; count: number }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = formatDateKey(date);
            data.push({
                date: key,
                count: completionCountMap.get(key) || 0,
            });
        }
        return data;
    }, [completionCountMap]);

    const chartSeries = useMemo(() => {
        const currentStreakData = baseChartData.map(({ date, count }) => ({
            date,
            value: count > 0 ? 1 : 0,
        }));

        let runningStreak = 0;
        const streakProgressData = baseChartData.map(({ date, count }) => {
            runningStreak = count > 0 ? runningStreak + 1 : 0;
            return { date, value: runningStreak };
        });

        let runningBest = 0;
        const bestStreakData = streakProgressData.map(({ date, value }) => {
            runningBest = Math.max(runningBest, value);
            return { date, value: runningBest };
        });

        let cumulativeTotal = 0;
        const totalCompletionsData = baseChartData.map(({ date, count }) => {
            cumulativeTotal += count;
            return { date, value: cumulativeTotal };
        });

        return {
            current: currentStreakData,
            best: bestStreakData,
            total: totalCompletionsData,
        };
    }, [baseChartData]);

    const renderMiniChart = (
        data: { date: string; value: number }[],
        colorClass: string
    ) => {
        const maxValue = Math.max(...data.map((d) => d.value), 1);
        return (
            <div className="mt-4 h-16 flex items-end gap-1">
                {data.map(({ date, value }) => {
                    const heightPercent = (value / maxValue) * 100;
                    const normalizedHeight = Math.max(6, heightPercent);
                    return (
                        <div
                            key={date}
                            className={`flex-1 rounded-t ${colorClass}`}
                            style={{
                                height: `${normalizedHeight}%`,
                                opacity: value > 0 ? 1 : 0.25,
                            }}
                            title={`${date}: ${value}`}
                        ></div>
                    );
                })}
            </div>
        );
    };

    useEffect(() => {
        loadHabit();
        loadCompletions();

        // Auto-start editing name for new habits
        if (isNewHabit) {
            setEditingField('name');
        }
    }, [uid]);

    useEffect(() => {
        editingFieldRef.current = editingField;
    }, [editingField]);

    useEffect(() => {
        if (editingField === 'name' && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        } else if (
            editingField === 'targetFrequency' &&
            targetCountInputRef.current
        ) {
            targetCountInputRef.current.focus();
            targetCountInputRef.current.select();
        } else if (
            editingField === 'flexibility' &&
            flexibilitySelectRef.current
        ) {
            flexibilitySelectRef.current.focus();
        } else if (editingField === 'streak' && streakSelectRef.current) {
            streakSelectRef.current.focus();
        }
    }, [editingField]);

    const isNewHabit = uid === 'new';

    const loadHabit = async () => {
        try {
            setLoading(true);

            if (isNewHabit) {
                // Initialize new habit with default values
                const newHabit: Partial<Task> = {
                    name: '',
                    habit_mode: true,
                    habit_target_count: 1,
                    habit_frequency_period: 'daily',
                    habit_streak_mode: 'calendar',
                    habit_flexibility_mode: 'flexible',
                    habit_current_streak: 0,
                    habit_best_streak: 0,
                    habit_total_completions: 0,
                };
                setHabit(newHabit as Task);
                setEditableValues(mapHabitToEditableValues(newHabit as Task));
            } else {
                const habits = await fetchHabits();
                const foundHabit = habits.find((h) => h.uid === uid);
                if (foundHabit) {
                    setHabit(foundHabit);
                    setEditableValues(mapHabitToEditableValues(foundHabit));
                } else {
                    navigate('/habits');
                }
            }
        } catch (error) {
            console.error('Failed to load habit:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCompletions = async () => {
        if (!uid || isNewHabit) return [];
        try {
            const startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(startDate.getDate() - (HISTORY_DAYS - 1));

            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);

            const comps = await fetchHabitCompletions(uid, startDate, endDate);
            setCompletions(comps);
            return comps;
        } catch (error) {
            console.error('Failed to load completions:', error);
            return [];
        }
    };

    const handleComplete = async () => {
        await handleToggleDay(new Date());
    };

    const handleSaveNewHabit = async () => {
        if (!editableValues.name?.trim()) {
            alert(t('habits.nameRequired', 'Please enter a habit name'));
            return;
        }

        try {
            const habitData: Partial<Task> = {
                name: editableValues.name.trim(),
                habit_mode: true,
                habit_target_count: editableValues.habit_target_count,
                habit_frequency_period: editableValues.habit_frequency_period,
                habit_streak_mode: editableValues.habit_streak_mode,
                habit_flexibility_mode: editableValues.habit_flexibility_mode,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                status: 'planned', // Show in today's plan
            };

            const created = await createHabit(habitData);
            navigate(`/habit/${created.uid}`);
        } catch (error) {
            console.error('Failed to create habit:', error);
            alert(t('habits.createError', 'Failed to create habit'));
        }
    };

    const handleDeleteHabit = async () => {
        if (!habit?.uid) return;
        if (
            !confirm(
                t(
                    'habits.confirmDelete',
                    'Are you sure you want to delete this habit?'
                )
            )
        ) {
            return;
        }

        try {
            await deleteHabit(habit.uid);
            navigate('/habits');
        } catch (error) {
            console.error('Failed to delete habit:', error);
            alert(t('habits.deleteError', 'Failed to delete habit'));
        }
    };

    const saveField = useCallback(
        async (field: EditableField) => {
            if (isNewHabit) {
                // For new habits, just update local state
                setEditingField(null);
                return;
            }

            if (!habit?.uid) {
                setEditingField(null);
                return;
            }

            let updates: Partial<Task> | null = null;

            switch (field) {
                case 'name': {
                    const trimmed = editableValues.name.trim();
                    if (!trimmed) {
                        setEditableValues((prev) => ({
                            ...prev,
                            name: habit.name || '',
                        }));
                        setEditingField(null);
                        return;
                    }
                    if (trimmed === (habit.name || '')) {
                        setEditingField(null);
                        return;
                    }
                    updates = { name: trimmed };
                    break;
                }
                case 'targetFrequency': {
                    const count = Math.max(
                        1,
                        editableValues.habit_target_count || 1
                    );
                    const period =
                        editableValues.habit_frequency_period || 'daily';
                    const currentCount = habit.habit_target_count || 1;
                    const currentPeriod =
                        (habit.habit_frequency_period as
                            | 'daily'
                            | 'weekly'
                            | 'monthly') || 'daily';
                    if (count === currentCount && period === currentPeriod) {
                        setEditableValues((prev) => ({
                            ...prev,
                            habit_target_count: currentCount,
                            habit_frequency_period: currentPeriod,
                        }));
                        setEditingField(null);
                        return;
                    }
                    updates = {
                        habit_target_count: count,
                        habit_frequency_period: period,
                    };
                    break;
                }
                case 'flexibility': {
                    const newValue =
                        editableValues.habit_flexibility_mode || 'flexible';
                    const currentValue =
                        (habit.habit_flexibility_mode as
                            | 'flexible'
                            | 'strict') || 'flexible';
                    if (newValue === currentValue) {
                        setEditingField(null);
                        return;
                    }
                    updates = { habit_flexibility_mode: newValue };
                    break;
                }
                case 'streak': {
                    const newValue =
                        editableValues.habit_streak_mode || 'calendar';
                    const currentValue =
                        (habit.habit_streak_mode as 'calendar' | 'scheduled') ||
                        'calendar';
                    if (newValue === currentValue) {
                        setEditingField(null);
                        return;
                    }
                    updates = { habit_streak_mode: newValue };
                    break;
                }
                default:
                    break;
            }

            if (!updates) {
                setEditingField(null);
                return;
            }

            try {
                setSavingField(field);
                const updated = await updateHabit(habit.uid, updates);
                setHabit(updated);
                setEditableValues(mapHabitToEditableValues(updated));
            } catch (error) {
                console.error('Failed to save habit details:', error);
                if (habit) {
                    setEditableValues(mapHabitToEditableValues(habit));
                }
            } finally {
                setSavingField((prev) => (prev === field ? null : prev));
                setEditingField((prev) => (prev === field ? null : prev));
            }
        },
        [habit, editableValues, isNewHabit]
    );

    const handleCancelField = (field: EditableField) => {
        if (!habit) {
            setEditingField(null);
            return;
        }
        const base = mapHabitToEditableValues(habit);
        setEditableValues((prev) => {
            switch (field) {
                case 'name':
                    return { ...prev, name: base.name };
                case 'targetFrequency':
                    return {
                        ...prev,
                        habit_target_count: base.habit_target_count,
                        habit_frequency_period: base.habit_frequency_period,
                    };
                case 'flexibility':
                    return {
                        ...prev,
                        habit_flexibility_mode: base.habit_flexibility_mode,
                    };
                case 'streak':
                    return {
                        ...prev,
                        habit_streak_mode: base.habit_streak_mode,
                    };
                default:
                    return prev;
            }
        });
        setEditingField((prev) => (prev === field ? null : prev));
    };

    const startEditingField = (field: EditableField) => {
        if (savingField === field) return;
        setEditingField(field);
    };

    const handleFieldKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
        field: EditableField
    ) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveField(field);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelField(field);
        }
    };

    useEffect(() => {
        if (!editingField) return;

        const handleMouseDown = (event: MouseEvent) => {
            let currentElement: HTMLElement | null = null;
            switch (editingField) {
                case 'name':
                    currentElement = titleInputRef.current;
                    break;
                case 'targetFrequency':
                    currentElement = targetFrequencyContainerRef.current;
                    break;
                case 'flexibility':
                    currentElement = flexibilityContainerRef.current;
                    break;
                case 'streak':
                    currentElement = streakContainerRef.current;
                    break;
                default:
                    currentElement = null;
            }

            if (
                currentElement &&
                currentElement.contains(event.target as Node)
            ) {
                return;
            }
            saveField(editingField);
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [editingField, saveField]);

    const handleToggleDay = async (date: Date) => {
        if (!habit?.uid) return;

        const dateStr = formatDateKey(date);
        const existingCompletion = completions.find((c) => {
            const compDate = formatDateKey(new Date(c.completed_at));
            return compDate === dateStr;
        });

        try {
            if (existingCompletion) {
                // Optimistic update - remove from UI immediately
                setCompletions((prev) =>
                    prev.filter((c) => c.id !== existingCompletion.id)
                );

                // Uncomplete - delete the completion
                const result = await deleteHabitCompletion(
                    habit.uid,
                    existingCompletion.id
                );
                setHabit(result.task);
                setEditableValues((prev) =>
                    editingFieldRef.current
                        ? prev
                        : mapHabitToEditableValues(result.task)
                );
            } else {
                // Complete - add the completion
                const completionDate = new Date(date);
                completionDate.setHours(12, 0, 0, 0); // Noon
                const completionKey = formatDateKey(completionDate);

                // Optimistic update - add to UI immediately
                const tempCompletion: HabitCompletion = {
                    id: Date.now(), // Temporary ID
                    task_id: habit.id!,
                    completed_at: completionDate.toISOString(),
                    original_due_date: completionDate.toISOString(),
                    skipped: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                setCompletions((prev) => [...prev, tempCompletion]);

                const result = await logHabitCompletion(
                    habit.uid,
                    completionDate
                );
                setHabit(result.task);
                setEditableValues((prev) =>
                    editingFieldRef.current
                        ? prev
                        : mapHabitToEditableValues(result.task)
                );

                setCompletions((prev) => {
                    const filtered = prev.filter(
                        (c) =>
                            formatDateKey(new Date(c.completed_at)) !==
                            completionKey
                    );
                    return [...filtered, result.completion];
                });
            }
        } catch (error) {
            console.error('Failed to toggle completion:', error);
            // Reload on error to revert optimistic update
            loadCompletions();
            loadHabit();
        }
    };

    const today = new Date();
    const calendarRanges = Array.from(
        { length: Math.ceil(HISTORY_DAYS / DAYS_PER_CALENDAR) },
        (_, idx) => {
            const rangeEnd = new Date(today);
            rangeEnd.setDate(rangeEnd.getDate() - idx * DAYS_PER_CALENDAR);
            const rangeStart = new Date(rangeEnd);
            rangeStart.setDate(rangeEnd.getDate() - (DAYS_PER_CALENDAR - 1));
            const monthLabel = rangeEnd.toLocaleString(undefined, {
                month: 'long',
                year: 'numeric',
            });
            return { rangeStart, rangeEnd, monthLabel };
        }
    );

    const renderCalendar = (rangeStart: Date, rangeEnd: Date) => {
        const normalizedStart = new Date(rangeStart);
        normalizedStart.setHours(0, 0, 0, 0);
        const normalizedEnd = new Date(rangeEnd);
        normalizedEnd.setHours(23, 59, 59, 999);
        const firstDay = new Date(normalizedStart);
        firstDay.setDate(firstDay.getDate() - firstDay.getDay());
        const lastDay = new Date(normalizedEnd);
        lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

        const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const calendarDays = [];
        const currentDate = new Date(firstDay);

        while (currentDate <= lastDay) {
            const dateStr = formatDateKey(currentDate);
            const isCompleted = completions.some((c) => {
                const compDate = formatDateKey(new Date(c.completed_at));
                return compDate === dateStr;
            });
            const isToday = dateStr === formatDateKey(today);
            const isBeforeRange = currentDate < normalizedStart;
            const isAfterRange = currentDate > normalizedEnd;
            const isFuture = currentDate > today;
            const isDisabled = isBeforeRange || isAfterRange || isFuture;
            const dayOfMonth = currentDate.getDate();
            const dateCopy = new Date(currentDate);

            calendarDays.push(
                <button
                    key={dateStr}
                    onClick={() => !isDisabled && handleToggleDay(dateCopy)}
                    disabled={isDisabled}
                    className={`
                        aspect-square flex items-center justify-center rounded-sm text-[9px] font-medium transition-colors
                        ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}
                        ${
                            isCompleted
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                        }
                        ${isToday ? 'ring-1 ring-blue-500' : ''}
                    `}
                    title={dateStr}
                >
                    {dayOfMonth}
                </button>
            );

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return (
            <div className="grid grid-cols-7 gap-0.5 w-full">
                {dayLabels.map((day, idx) => (
                    <div
                        key={`${day}-${idx}`}
                        className="text-center text-[9px] font-medium text-gray-600 dark:text-gray-400"
                    >
                        {day}
                    </div>
                ))}
                {calendarDays}
            </div>
        );
    };

    const orderedCalendarRanges = [...calendarRanges].reverse();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    if (!habit) {
        return null;
    }

    return (
        <div className="w-full pb-12">
            <div className="w-full px-4 sm:px-6 lg:px-10">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/habits')}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        {t('common.back', 'Back to Habits')}
                    </button>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FireIcon className="h-8 w-8 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                {editingField === 'name' ? (
                                    <input
                                        ref={(el) => {
                                            titleInputRef.current = el;
                                        }}
                                        type="text"
                                        value={editableValues.name}
                                        onChange={(e) =>
                                            setEditableValues((prev) => ({
                                                ...prev,
                                                name: e.target.value,
                                            }))
                                        }
                                        onKeyDown={(e) =>
                                            handleFieldKeyDown(e, 'name')
                                        }
                                        className="w-full bg-transparent border-b border-gray-300 dark:border-gray-700 text-3xl font-bold text-gray-900 dark:text-white focus:outline-none"
                                        placeholder={t(
                                            'habits.namePlaceholder',
                                            'Enter habit name...'
                                        )}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="text-left text-3xl font-bold text-gray-900 dark:text-white break-words focus:outline-none cursor-text hover:text-gray-700 dark:hover:text-gray-300"
                                        onClick={() =>
                                            startEditingField('name')
                                        }
                                    >
                                        {editableValues.name ||
                                            t(
                                                'habits.untitledHabit',
                                                'Untitled Habit'
                                            )}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {isNewHabit ? (
                                <button
                                    onClick={handleSaveNewHabit}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    {t('common.save', 'Save')}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleDeleteHabit}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                        {t('common.delete', 'Delete')}
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                    >
                                        <CheckCircleIcon className="h-5 w-5" />
                                        {t('habits.complete', 'Complete')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 mb-8">
                    {/* Details */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 lg:w-1/3">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('habits.details', 'Details')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {t(
                                    'habits.inlineEditHint',
                                    'Click a value to edit. Press Enter or click outside to save.'
                                )}
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t(
                                        'habits.targetFrequency',
                                        'Target Frequency'
                                    )}
                                </span>
                                {editingField === 'targetFrequency' ? (
                                    <div
                                        ref={targetFrequencyContainerRef}
                                        className="flex flex-col sm:flex-row items-center gap-2 sm:justify-end w-full sm:w-auto"
                                    >
                                        <input
                                            ref={targetCountInputRef}
                                            type="number"
                                            min={1}
                                            value={
                                                editableValues.habit_target_count
                                            }
                                            onChange={(e) =>
                                                setEditableValues((prev) => ({
                                                    ...prev,
                                                    habit_target_count:
                                                        Math.max(
                                                            1,
                                                            parseInt(
                                                                e.target.value,
                                                                10
                                                            ) || 1
                                                        ),
                                                }))
                                            }
                                            onKeyDown={(e) =>
                                                handleFieldKeyDown(
                                                    e,
                                                    'targetFrequency'
                                                )
                                            }
                                            className="w-full sm:w-20 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {t('habits.timesPer', 'times per')}
                                        </span>
                                        <select
                                            value={
                                                editableValues.habit_frequency_period
                                            }
                                            onChange={(e) =>
                                                setEditableValues((prev) => ({
                                                    ...prev,
                                                    habit_frequency_period: e
                                                        .target.value as
                                                        | 'daily'
                                                        | 'weekly'
                                                        | 'monthly',
                                                }))
                                            }
                                            onKeyDown={(e) =>
                                                handleFieldKeyDown(
                                                    e,
                                                    'targetFrequency'
                                                )
                                            }
                                            className="w-full sm:w-32 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        >
                                            <option value="daily">
                                                {t('habits.day', 'Day')}
                                            </option>
                                            <option value="weekly">
                                                {t('habits.week', 'Week')}
                                            </option>
                                            <option value="monthly">
                                                {t('habits.month', 'Month')}
                                            </option>
                                        </select>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="text-right text-gray-900 dark:text-white font-medium focus:outline-none cursor-text"
                                        onClick={() =>
                                            startEditingField('targetFrequency')
                                        }
                                    >
                                        {editableValues.habit_target_count}x per{' '}
                                        {editableValues.habit_frequency_period ===
                                        'daily'
                                            ? t('habits.day', 'Day')
                                            : editableValues.habit_frequency_period ===
                                                'weekly'
                                              ? t('habits.week', 'Week')
                                              : t('habits.month', 'Month')}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('habits.scheduling', 'Scheduling')}
                                </span>
                                {editingField === 'flexibility' ? (
                                    <div
                                        ref={flexibilityContainerRef}
                                        className="w-full sm:w-auto"
                                    >
                                        <select
                                            ref={flexibilitySelectRef}
                                            value={
                                                editableValues.habit_flexibility_mode
                                            }
                                            onChange={(e) =>
                                                setEditableValues((prev) => ({
                                                    ...prev,
                                                    habit_flexibility_mode: e
                                                        .target.value as
                                                        | 'flexible'
                                                        | 'strict',
                                                }))
                                            }
                                            onKeyDown={(e) =>
                                                handleFieldKeyDown(
                                                    e,
                                                    'flexibility'
                                                )
                                            }
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white capitalize"
                                        >
                                            <option value="flexible">
                                                {t(
                                                    'habits.flexible',
                                                    'Flexible (anytime)'
                                                )}
                                            </option>
                                            <option value="strict">
                                                {t('habits.strict', 'Strict')}
                                            </option>
                                        </select>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="text-right text-gray-900 dark:text-white font-medium focus:outline-none cursor-text capitalize"
                                        onClick={() =>
                                            startEditingField('flexibility')
                                        }
                                    >
                                        {editableValues.habit_flexibility_mode ===
                                        'flexible'
                                            ? t(
                                                  'habits.flexible',
                                                  'Flexible (anytime)'
                                              )
                                            : t('habits.strict', 'Strict')}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t(
                                        'habits.streakCalc',
                                        'Streak Calculation'
                                    )}
                                </span>
                                {editingField === 'streak' ? (
                                    <div
                                        ref={streakContainerRef}
                                        className="w-full sm:w-auto"
                                    >
                                        <select
                                            ref={streakSelectRef}
                                            value={
                                                editableValues.habit_streak_mode
                                            }
                                            onChange={(e) =>
                                                setEditableValues((prev) => ({
                                                    ...prev,
                                                    habit_streak_mode: e.target
                                                        .value as
                                                        | 'calendar'
                                                        | 'scheduled',
                                                }))
                                            }
                                            onKeyDown={(e) =>
                                                handleFieldKeyDown(e, 'streak')
                                            }
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white capitalize"
                                        >
                                            <option value="calendar">
                                                {t(
                                                    'habits.calendarDays',
                                                    'Calendar days'
                                                )}
                                            </option>
                                            <option value="scheduled">
                                                {t(
                                                    'habits.scheduledPeriods',
                                                    'Scheduled periods'
                                                )}
                                            </option>
                                        </select>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="text-right text-gray-900 dark:text-white font-medium focus:outline-none cursor-text capitalize"
                                        onClick={() =>
                                            startEditingField('streak')
                                        }
                                    >
                                        {editableValues.habit_streak_mode ===
                                        'calendar'
                                            ? t(
                                                  'habits.calendarDays',
                                                  'Calendar days'
                                              )
                                            : t(
                                                  'habits.scheduledPeriods',
                                                  'Scheduled periods'
                                              )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid - Only show for existing habits */}
                    {!isNewHabit && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:flex-1">
                            {/* Current Streak */}
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <FireIcon className="h-6 w-6 text-orange-500" />
                                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        {t(
                                            'habits.currentStreak',
                                            'Current Streak'
                                        )}
                                    </h3>
                                </div>
                                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                                    {habit.habit_current_streak || 0}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {t('habits.days', 'days')}
                                </p>
                                {renderMiniChart(
                                    chartSeries.current,
                                    'bg-green-500'
                                )}
                            </div>

                            {/* Best Streak */}
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                    {t('habits.bestStreak', 'Best Streak')}
                                </h3>
                                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                                    {habit.habit_best_streak || 0}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {t('habits.days', 'days')}
                                </p>
                                {renderMiniChart(
                                    chartSeries.best,
                                    'bg-blue-500'
                                )}
                            </div>

                            {/* Total Completions */}
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                    {t(
                                        'habits.totalCompletions',
                                        'Total Completions'
                                    )}
                                </h3>
                                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                                    {habit.habit_total_completions || 0}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {t('habits.times', 'times')}
                                </p>
                                {renderMiniChart(
                                    chartSeries.total,
                                    'bg-purple-500'
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Calendar History - Last 90 Days - Only show for existing habits */}
                {!isNewHabit && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            {t('habits.history', 'Last 90 Days')}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {t(
                                'habits.clickToToggle',
                                'Click on a day to mark as complete or undo'
                            )}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {orderedCalendarRanges.map(
                                ({ rangeStart, rangeEnd, monthLabel }, idx) => (
                                    <div
                                        key={`calendar-${idx}`}
                                        className="space-y-2"
                                    >
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                            {monthLabel}
                                        </p>
                                        <div className="w-full">
                                            {renderCalendar(
                                                rangeStart,
                                                rangeEnd
                                            )}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-500"></div>
                                <span>
                                    {t('habits.completed', 'Completed')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-800"></div>
                                <span>
                                    {t('habits.notCompleted', 'Not completed')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-sm ring-1 ring-blue-500 bg-gray-200 dark:bg-gray-800"></div>
                                <span>{t('habits.today', 'Today')}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HabitDetails;
