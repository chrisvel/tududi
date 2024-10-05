import React from 'react';

interface TaskStatusBadgeProps {
  status: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status }) => {
  const getStatusClass = () => {
    switch (status) {
      case 'not_started':
        return 'bg-yellow-100 text-yellow-600';
      case 'in_progress':
        return 'bg-blue-100 text-blue-600';
      case 'done':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  return <span className={`badge py-1 rounded px-3 text-xs text-white ${getStatusClass()}`}>{status.replace('_', ' ').toUpperCase()}</span>;
};

export default TaskStatusBadge;
