import React, { useState } from 'react';
import { useToast } from '../../components/Shared/ToastContext'; 
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

interface NewTaskProps {
  onTaskCreate: (taskName: string) => void;
}

const NewTask: React.FC<NewTaskProps> = ({ onTaskCreate }) => {
  const [taskName, setTaskName] = useState<string>('');
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTaskName(event.target.value);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && taskName.trim()) {
      try {
        await onTaskCreate(taskName.trim());
        setTaskName('');
        showSuccessToast(t('success.taskCreated', 'Task created successfully!'));
      } catch (error) {
        console.error('Error creating task:', error);
        showErrorToast(t('errors.taskCreate', 'Failed to create task.'));
      }
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 mb-2 border-b border-gray-200 dark:border-gray-800 rounded-lg shadow-sm bg-white dark:bg-gray-900">
      <span className="text-xl text-gray-500 dark:text-gray-400 mr-4">
        <PlusCircleIcon className="h-6 w-6" />
      </span>
      <input
        type="text"
        value={taskName}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="font-medium text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 bg-transparent dark:bg-transparent focus:outline-none focus:ring-0 w-full appearance-none"
        placeholder={t('tasks.addNewTask', 'Προσθήκη Νέας Εργασίας')}
      />
    </div>
  );
};

export default NewTask;
