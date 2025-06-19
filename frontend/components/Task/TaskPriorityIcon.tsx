import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

interface TaskPriorityIconProps {
  priority: string | number | undefined;
  status: string | number;
  onToggleCompletion?: () => void;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({ priority, status, onToggleCompletion }) => {
  const { t } = useTranslation();
  const getIconColor = () => {
    if (status === 'done' || status === 2) return 'text-green-500';
    
    // Handle both string and numeric priority values
    let priorityStr = priority;
    if (typeof priority === 'number') {
      const priorityNames = ['low', 'medium', 'high'];
      priorityStr = priorityNames[priority] || 'low';
    }
    
    switch (priorityStr) {
      case 'high':
      case 2:
        return 'text-red-500';
      case 'medium':
      case 1:
        return 'text-yellow-500';
      case 'low':
      case 0:
      default:
        return 'text-gray-300';
    }
  };

  const colorClass = getIconColor();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering TaskHeader onClick
    if (onToggleCompletion) {
      onToggleCompletion();
    }
  };

  if (status === 'done' || status === 2) {
    return (
      <CheckCircleIcon 
        className={`h-5 w-5 ${colorClass} cursor-pointer hover:scale-110 transition-transform`} 
        onClick={handleClick}
      />
    );
  } else {
    return (
      <svg
        className={`h-5 w-5 ${colorClass} cursor-pointer hover:scale-110 transition-transform`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        onClick={handleClick}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }
};

export default TaskPriorityIcon;
