import React from 'react';
import { Task } from '../../entities/Task';
import { ACCENT } from '../../constants/colorPalette';
import {
    formatAmount,
    habitGoal,
    isMeasurableHabit,
} from '../../utils/habitUtils';

// Large goals are drawn as at most five segments so "20× a day" still reads
// as a bar, each segment worth a fifth of the goal.
const MAX_SEGMENTS = 5;

interface HabitProgressBarProps {
    habit: Task;
    showLabel?: boolean;
}

const HabitProgressBar: React.FC<HabitProgressBarProps> = ({
    habit,
    showLabel = true,
}) => {
    const goal = habitGoal(habit);
    const progress = habit.habit_progress?.progress ?? 0;
    const measurable = isMeasurableHabit(habit);
    const segments =
        measurable || goal > MAX_SEGMENTS ? MAX_SEGMENTS : Math.max(1, goal);
    const perSegment = goal / segments;
    const met = progress >= goal;

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1" aria-hidden="true">
                {Array.from({ length: segments }, (_, i) => {
                    const fill = Math.max(
                        0,
                        Math.min(1, (progress - i * perSegment) / perSegment)
                    );
                    return (
                        <div
                            key={i}
                            className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden"
                        >
                            <div
                                className={`h-full rounded-full transition-all ${ACCENT.bg}`}
                                style={{
                                    width: `${fill * 100}%`,
                                    opacity: met ? 1 : 0.75,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            {showLabel && (
                <span
                    className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 shrink-0"
                    aria-label={`${formatAmount(progress)} / ${formatAmount(goal)}`}
                >
                    {formatAmount(progress)}/{formatAmount(goal)}
                    {measurable && habit.habit_unit
                        ? ` ${habit.habit_unit}`
                        : ''}
                </span>
            )}
        </div>
    );
};

export default HabitProgressBar;
