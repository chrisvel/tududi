import React from 'react';
import { MinusIcon, CheckCircleIcon, ArchiveBoxIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

interface TaskStatusBadgeProps {
  status: string;
  className?: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, className }) => {
  const { t } = useTranslation();
  let statusIcon, statusLabel;

  switch (status) {
    case 'not_started':
      statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = t('status.notStarted', 'Not Started');
      break;
    case 'in_progress':
      statusIcon = <ArrowPathIcon className="h-4 w-4 text-blue-400" />;
      statusLabel = t('status.inProgress', 'In Progress');
      break;
    case 'done':
      statusIcon = <CheckCircleIcon className="h-4 w-4 text-green-400" />;
      statusLabel = t('status.done', 'Done');
      break;
    case 'archived':
      statusIcon = <ArchiveBoxIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = t('status.archived', 'Archived');
      break;
    default:
      statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
      statusLabel = t('status.unknown', 'Unknown');
  }

  return (
    <div className={`flex items-center md:px-2 ${className}`}>
      {statusIcon}
      {/* <span className="ml-2 text-xs font-medium inline md:hidden">{statusLabel}</span> */}
    </div>
  );
};

export default TaskStatusBadge;
