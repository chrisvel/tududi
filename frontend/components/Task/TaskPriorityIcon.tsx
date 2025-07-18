import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface TaskPriorityIconProps {
    priority: string | number | undefined;
    status: string | number;
    onToggleCompletion?: () => void;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({
    priority,
    status,
    onToggleCompletion,
}) => {
    const getIconColor = () => {
        if (
            status === 'done' ||
            status === 2 ||
            status === 'archived' ||
            status === 3
        )
            return 'text-green-500';

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

    if (
        status === 'done' ||
        status === 2 ||
        status === 'archived' ||
        status === 3
    ) {
        return (
            <CheckCircleIcon
                className={`h-5 w-5 ${colorClass} cursor-pointer hover:scale-110 transition-transform flex-shrink-0`}
                style={{ width: '20px', height: '20px' }}
                onClick={handleClick}
            />
        );
    } else {
        return (
            <div
                className={`h-5 w-5 ${colorClass} cursor-pointer hover:scale-110 transition-transform border-2 border-current rounded-full flex-shrink-0`}
                style={{ width: '20px', height: '20px' }}
                onClick={handleClick}
            />
        );
    }
};

export default TaskPriorityIcon;
