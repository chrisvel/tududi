// Life-to-Day (T-503): the optional first step the Now card shows before
// the task itself. Saved on blur or Enter; empty clears it.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';

interface TaskStarterStepCardProps {
    task: Task;
    onChange: (step: string | null) => Promise<void> | void;
}

const TaskStarterStepCard: React.FC<TaskStarterStepCardProps> = ({
    task,
    onChange,
}) => {
    const { t } = useTranslation();
    const saved = task.starter_step ?? '';
    const [value, setValue] = useState(saved);
    useEffect(() => setValue(saved), [saved]);

    const commit = () => {
        const next = value.trim();
        if (next !== saved) onChange(next || null);
    };

    return (
        <div>
            <label
                htmlFor="task-starter-step"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
                {t('task.starterStep', 'First step')}
            </label>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors flex flex-col gap-2">
                <input
                    id="task-starter-step"
                    type="text"
                    value={value}
                    maxLength={500}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        }
                    }}
                    placeholder={t(
                        'task.starterStepPlaceholder',
                        'Something you can do in 5 minutes'
                    )}
                    className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    data-testid="task-starter-step"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'task.starterStepHint',
                        'Shown first on the Now card, to make starting easy.'
                    )}
                </span>
            </div>
        </div>
    );
};

export default TaskStarterStepCard;
