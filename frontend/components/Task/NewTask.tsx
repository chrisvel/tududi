import React, { useState } from 'react';
import { useToast } from '../../components/Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

interface NewTaskProps {
    onTaskCreate: (taskName: string) => Promise<void>;
}

const NewTask: React.FC<NewTaskProps> = ({ onTaskCreate }) => {
    const [taskName, setTaskName] = useState<string>('');
    const { showErrorToast } = useToast();
    const { t } = useTranslation();

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTaskName(event.target.value);
    };

    const handleKeyDown = async (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === 'Enter' && taskName.trim()) {
            const taskText = taskName.trim();
            setTaskName('');

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
        </div>
    );
};

export default NewTask;
