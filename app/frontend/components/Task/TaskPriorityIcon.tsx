import React from 'react';

interface TaskPriorityIconProps {
  priority: string | undefined;
  status: string;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({ priority, status }) => {
  const getPriorityClass = () => {
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

  return <i className={`bi bi-circle ${getPriorityClass()}`}></i>;
};

export default TaskPriorityIcon;
