import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { getTaskIntelligenceEnabled } from '../../utils/profileService';

interface NewTaskProps {
    onTaskCreate: (taskName: string) => Promise<void>;
}

const NewTask: React.FC<NewTaskProps> = ({ onTaskCreate }) => {
    const [taskName, setTaskName] = useState<string>('');
    const [showNameLengthHelper, setShowNameLengthHelper] = useState(false);
    const [taskIntelligenceEnabled, setTaskIntelligenceEnabled] =
        useState(false);
    const { showErrorToast } = useToast();
    const { t } = useTranslation();

    // Fetch task intelligence setting when component mounts (with caching)
    useEffect(() => {
        const fetchTaskIntelligenceSetting = async () => {
            // Check if we have a cached value
            const cachedValue = localStorage.getItem('taskIntelligenceEnabled');
            if (cachedValue !== null) {
                setTaskIntelligenceEnabled(JSON.parse(cachedValue));
                return;
            }

            try {
                const enabled = await getTaskIntelligenceEnabled();
                setTaskIntelligenceEnabled(enabled);
                // Cache the value for future use
                localStorage.setItem(
                    'taskIntelligenceEnabled',
                    JSON.stringify(enabled)
                );
            } catch {
                setTaskIntelligenceEnabled(false); // Default to disabled on error
                localStorage.setItem(
                    'taskIntelligenceEnabled',
                    JSON.stringify(false)
                );
            }
        };

        fetchTaskIntelligenceSetting();
    }, []);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setTaskName(value);

        // Show helper message for task name if it's too short (only if intelligence is enabled)
        if (taskIntelligenceEnabled) {
            const trimmedValue = value.trim();
            setShowNameLengthHelper(
                trimmedValue.length > 0 && trimmedValue.length < 10
            );
        }
    };

    const handleKeyDown = async (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === 'Enter' && taskName.trim()) {
            const taskText = taskName.trim();
            setTaskName('');
            setShowNameLengthHelper(false); // Hide helper when creating task

            try {
                await onTaskCreate(taskText);
                // Success toast is now handled by the parent component
            } catch (error) {
                console.error('NewTask: Error creating task:', error);
                setTaskName(taskText);
                showErrorToast(
                    t('errors.taskCreate', 'Failed to create task.')
                );
            }
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between py-3.5 px-5 border-b border-gray-200 dark:border-gray-800 rounded-lg shadow-sm bg-white dark:bg-gray-900">
                <span className="text-xl text-gray-500 dark:text-gray-400 mr-2">
                    <PlusCircleIcon className="h-5 w-5" />
                </span>
                <input
                    type="text"
                    value={taskName}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="font-semibold text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 bg-transparent dark:bg-transparent focus:outline-none focus:ring-0 w-full appearance-none"
                    placeholder={t(
                        'tasks.addNewTask',
                        'Προσθήκη Νέας Εργασίας'
                    )}
                    data-testid="new-task-input"
                />
            </div>
            {showNameLengthHelper && taskIntelligenceEnabled && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-4 w-4 text-blue-400 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="ml-2">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>
                                    {t(
                                        'task.nameHelper.title',
                                        'Make it more descriptive!'
                                    )}
                                </strong>
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                {t(
                                    'task.nameHelper.suggestion',
                                    'Try adding more details like "Call dentist to schedule cleaning appointment" instead of just "Call dentist"'
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewTask;
