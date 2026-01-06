import React, { useState } from 'react';
import { Task } from '../../entities/Task';
import {
    createHabit,
    updateHabit,
    deleteHabit,
} from '../../utils/habitsService';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

interface HabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    habit: Task | null;
    onSave: () => void;
}

const HabitModal: React.FC<HabitModalProps> = ({
    isOpen,
    onClose,
    habit,
    onSave,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Task>>(
        habit || {
            name: '',
            habit_mode: true,
            habit_target_count: 1,
            habit_frequency_period: 'daily',
            habit_streak_mode: 'calendar',
            habit_flexibility_mode: 'flexible',
            recurrence_type: 'daily',
            recurrence_interval: 1,
        }
    );

    const handleSave = async () => {
        try {
            // Set planned status for new habits to show in "Planned" section
            const habitData = { ...formData };
            if (!habit?.uid) {
                habitData.status = 'planned';
            }

            if (habit?.uid) {
                await updateHabit(habit.uid, habitData);
            } else {
                await createHabit(habitData);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
        }
    };

    const handleDelete = async () => {
        if (!habit?.uid) return;
        if (!confirm('Are you sure you want to delete this habit?')) return;

        try {
            await deleteHabit(habit.uid);
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to delete habit:', error);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 m-4">
                <h2 className="text-2xl font-bold mb-4 dark:text-white">
                    {habit
                        ? t('habits.edit', 'Edit Habit')
                        : t('habits.create', 'Create Habit')}
                </h2>

                {/* Name */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 dark:text-white">
                        {t('habits.name', 'Habit Name')}
                    </label>
                    <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={t(
                            'habits.namePlaceholder',
                            'e.g., Morning meditation'
                        )}
                    />
                </div>

                {/* Target Frequency */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 dark:text-white">
                        {t('habits.targetFrequency', 'Target Frequency')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="1"
                            value={formData.habit_target_count || 1}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    habit_target_count: parseInt(
                                        e.target.value
                                    ),
                                })
                            }
                            className="w-20 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <span className="self-center dark:text-white">
                            {t('habits.timesPer', 'times per')}
                        </span>
                        <select
                            value={formData.habit_frequency_period || 'daily'}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    habit_frequency_period: e.target.value as
                                        | 'daily'
                                        | 'weekly'
                                        | 'monthly',
                                })
                            }
                            className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                </div>

                {/* Flexibility Mode */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 dark:text-white">
                        {t('habits.scheduling', 'Scheduling')}
                    </label>
                    <select
                        value={formData.habit_flexibility_mode || 'flexible'}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                habit_flexibility_mode: e.target.value as
                                    | 'strict'
                                    | 'flexible',
                            })
                        }
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="flexible">
                            {t('habits.flexible', 'Flexible (anytime)')}
                        </option>
                        <option value="strict">
                            {t('habits.strict', 'Strict (specific schedule)')}
                        </option>
                    </select>
                </div>

                {/* Streak Mode */}
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1 dark:text-white">
                        {t('habits.streakCalc', 'Streak Calculation')}
                    </label>
                    <select
                        value={formData.habit_streak_mode || 'calendar'}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                habit_streak_mode: e.target.value as
                                    | 'calendar'
                                    | 'scheduled',
                            })
                        }
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="calendar">
                            {t('habits.calendarDays', 'Calendar days')}
                        </option>
                        <option value="scheduled">
                            {t(
                                'habits.scheduledOccurrences',
                                'Scheduled occurrences'
                            )}
                        </option>
                    </select>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                    <div>
                        {habit && (
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                {t('common.delete', 'Delete')}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white transition"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default HabitModal;
