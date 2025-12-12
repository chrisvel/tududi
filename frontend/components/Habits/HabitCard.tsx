import React from 'react';
import { Task } from '../../entities/Task';
import { CheckCircleIcon, FireIcon } from '@heroicons/react/24/outline';

interface HabitCardProps {
    habit: Task;
    onComplete: (uid: string) => void;
    onEdit: (habit: Task) => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ habit, onComplete, onEdit }) => {
    return (
        <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onEdit(habit)}
        >
            <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold dark:text-white flex-1">
                    {habit.name}
                </h3>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onComplete(habit.uid!);
                    }}
                    className="text-green-600 hover:text-green-700 transition"
                    title="Complete habit"
                >
                    <CheckCircleIcon className="w-8 h-8" />
                </button>
            </div>

            {/* Streak display */}
            {habit.habit_current_streak !== undefined &&
                habit.habit_current_streak > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-orange-600">
                        <FireIcon className="w-5 h-5" />
                        <span className="font-bold">
                            {habit.habit_current_streak}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            day streak
                        </span>
                    </div>
                )}

            {/* Frequency target */}
            {habit.habit_target_count && habit.habit_frequency_period && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Target: {habit.habit_target_count}x per{' '}
                    {habit.habit_frequency_period}
                </div>
            )}

            {/* Total completions */}
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {habit.habit_total_completions || 0} total completions
            </div>
        </div>
    );
};

export default HabitCard;
