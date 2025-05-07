import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

interface TaskPriorityIconProps {
  priority: string | undefined;
  status: string;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({ priority, status }) => {
  const { t } = useTranslation();
  const getIconColor = () => {
    if (status === 'done') return 'text-green-500';
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-gray-300';
    }
  };

  const colorClass = getIconColor();

  if (status === 'done') {
    return <CheckCircleIcon className={`h-5 w-5 ${colorClass}`} />;
  } else {
    return (
      <svg
        className={`h-5 w-5 ${colorClass}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }
};

export default TaskPriorityIcon;
