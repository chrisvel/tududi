import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import DurationChips from '../../DailyPlan/DurationChips';

interface TaskEstimateCardProps {
    task: Task;
    onChange: (minutes: number | null) => void;
}

const TaskEstimateCard: React.FC<TaskEstimateCardProps> = ({
    task,
    onChange,
}) => {
    const { t } = useTranslation();
    const value = task.estimated_minutes ?? null;

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.estimate', 'Estimate')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors flex flex-wrap items-center gap-3">
                <DurationChips
                    value={value}
                    onChange={(minutes) =>
                        onChange(minutes === value ? null : minutes)
                    }
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {value === null
                        ? t(
                              'task.estimateHint',
                              'Roughly how long? Used when you plan your day.'
                          )
                        : t('task.estimateClearHint', 'Click again to clear')}
                </span>
            </div>
        </div>
    );
};

export default TaskEstimateCard;
