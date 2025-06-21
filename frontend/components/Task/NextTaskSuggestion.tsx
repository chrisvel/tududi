import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { useToast } from '../Shared/ToastContext';

interface NextTaskSuggestionProps {
  metrics: {
    tasks_due_today: Task[];
    suggested_tasks: Task[];
    tasks_in_progress: Task[];
  };
  onTaskUpdate: (task: Task) => Promise<void>;
  onClose?: () => void;
}

const NextTaskSuggestion: React.FC<NextTaskSuggestionProps> = ({ 
  metrics,
  onTaskUpdate, 
  onClose 
}) => {
  const { t } = useTranslation();
  const { showSuccessToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if there are any tasks in progress
  // If there are tasks in progress, don't show the suggestion
  if (metrics.tasks_in_progress.length > 0) {
    return null;
  }


  // Find the next suggested task following priority order:
  // 1. Due today tasks (not in progress)
  // 2. Suggested tasks from today page (not in progress)
  
  let suggestedTask: Task | null = null;
  let suggestionSource = '';

  // Helper function to check if task is not started
  const isNotStarted = (task: Task) => {
    return task.status === 'not_started' || task.status === 0;
  };


  // 1. First check due today tasks
  const dueTodayAvailable = metrics.tasks_due_today.filter(isNotStarted);
  
  if (dueTodayAvailable.length > 0) {
    suggestedTask = dueTodayAvailable[0]; // Take the first due today
    suggestionSource = 'due_today';
  } else {
    // 2. Then check suggested tasks from today page
    const suggestedAvailable = metrics.suggested_tasks.filter(isNotStarted);
    
    if (suggestedAvailable.length > 0) {
      suggestedTask = suggestedAvailable[0]; // Take the first suggested
      suggestionSource = 'suggested';
    }
  }

  if (!suggestedTask) {
    return null;
  }

  const handleStartTask = async () => {
    if (!suggestedTask || !suggestedTask.id) return;

    setIsUpdating(true);
    try {
      const updatedTask = { ...suggestedTask, status: 'in_progress' as const };
      await onTaskUpdate(updatedTask);
      showSuccessToast(t('task.startedSuccessfully', 'Task started successfully!'));
    } catch (error) {
      console.error('Error starting task:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-900 border-l-4 border-green-500 rounded-lg shadow relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
      
      <div className="flex items-start">
        <PlayIcon className="h-6 w-6 text-green-500 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
        <div className="flex-1 pr-8">
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-2 break-words">
            {suggestionSource === 'due_today' && t('nextTask.suggestionDueToday', 'Since there is nothing in progress, what about starting with this task due today')}
            {suggestionSource === 'suggested' && t('nextTask.suggestionSuggested', 'Since there is nothing in progress, what about starting with this suggested task')}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 mb-3">
            <p className="text-gray-900 dark:text-gray-100 font-medium break-words">
              {suggestedTask.name}
            </p>
            {suggestedTask.due_date && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('forms.task.labels.dueDate', 'Due')}: {new Date(suggestedTask.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={handleStartTask}
            disabled={isUpdating}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            <PlayIcon className="h-4 w-4 mr-2" />
            {isUpdating 
              ? t('nextTask.starting', 'Starting...') 
              : t('nextTask.letsDoIt', "Yes, let's do it!")
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default NextTaskSuggestion;