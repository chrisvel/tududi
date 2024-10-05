import React from 'react';
import { MinusIcon, CheckCircleIcon, ArchiveBoxIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface TaskStatusBadgeProps {
  status: string;
  className?: string; // Allows passing custom classes for spacing
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, className }) => {
  let statusIcon, statusLabel, badgeClass;

  switch (status) {
    case 'not_started':
      statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = 'Not Started';
      badgeClass = 'border-gray-400 text-gray-400 dark:text-gray-400 dark:border-gray-700';
      break;
    case 'in_progress':
      statusIcon = <ArrowPathIcon className="h-4 w-4 text-blue-400" />;
      statusLabel = 'In Progress';
      badgeClass = 'border-blue-400 text-blue-400 dark:text-blue-400 dark:border-blue-700';
      break;
    case 'done':
      statusIcon = <CheckCircleIcon className="h-4 w-4 text-green-400" />;
      statusLabel = 'Done';
      badgeClass = 'border-green-400 text-green-400 dark:text-green-400 dark:border-green-700';
      break;
    case 'archived':
      statusIcon = <ArchiveBoxIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = 'Archived';
      badgeClass = 'border-gray-400 text-gray-400 dark:text-gray-400 dark:border-gray-700';
      break;
    default:
      statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = 'Unknown';
      badgeClass = 'border-gray-400 text-gray-400 dark:text-gray-400 dark:border-gray-700';
  }

  return (
    <div
      className={`flex items-center justify-center px-2 py-1 rounded-md border ${badgeClass} w-10 ${className}`}
    >
      {statusIcon}
      <span className="text-xs font-medium"></span>
    </div>
  );
};

export default TaskStatusBadge;
