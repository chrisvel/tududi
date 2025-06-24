import React from 'react';
import { useTranslation } from 'react-i18next';
import { PriorityType, StatusType } from '../../../entities/Task';
import StatusDropdown from '../../Shared/StatusDropdown';
import PriorityDropdown from '../../Shared/PriorityDropdown';

interface TaskMetadataSectionProps {
  status: StatusType;
  priority: PriorityType;
  dueDate: string;
  taskId: number | undefined;
  onStatusChange: (value: StatusType) => void;
  onPriorityChange: (value: PriorityType) => void;
  onDueDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const TaskMetadataSection: React.FC<TaskMetadataSectionProps> = ({
  status,
  priority,
  dueDate,
  taskId,
  onStatusChange,
  onPriorityChange,
  onDueDateChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('forms.task.labels.status', 'Status')}
        </label>
        <StatusDropdown
          value={status}
          onChange={onStatusChange}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('forms.task.labels.priority', 'Priority')}
        </label>
        <PriorityDropdown
          value={priority}
          onChange={onPriorityChange}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('forms.task.labels.dueDate', 'Due Date')}
        </label>
        <input
          type="date"
          id={`task_due_date_${taskId}`}
          name="due_date"
          value={dueDate}
          onChange={onDueDateChange}
          className="block w-full focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
};

export default TaskMetadataSection;