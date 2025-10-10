import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface TaskPriorityIconProps {
    priority: string | number | undefined;
    status: string | number;
    onToggleCompletion?: () => void;
    testIdSuffix?: string;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({
    priority,
    status,
    onToggleCompletion,
    testIdSuffix = '',
}) => {
    const getPriorityText = () => {
        // Handle both string and numeric priority values
        let priorityStr = priority;
        if (typeof priority === 'number') {
            const priorityNames = ['low', 'medium', 'high'];
            priorityStr = priorityNames[priority] || 'low';
        }

        switch (priorityStr) {
            case 'high':
            case 2:
                return 'High priority';
            case 'medium':
            case 1:
                return 'Medium priority';
            case 'low':
            case 0:
            default:
                return 'Low priority';
        }
    };

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
                className={`${colorClass} cursor-pointer flex-shrink-0 transition-all duration-300 ease-in-out animate-scale-in`}
                style={{
                    width: '20px',
                    height: '20px',
                    marginLeft: '-2px',
                    marginRight: '-2px',
                }}
                onClick={handleClick}
                title={getPriorityText()}
                role="checkbox"
                aria-checked="true"
                data-testid={`task-completion-checkbox${testIdSuffix}`}
            />
        );
    } else {
        return (
            <div
                className={`${colorClass} cursor-pointer border-2 border-current rounded-full flex-shrink-0 transition-all duration-300 ease-in-out hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20`}
                style={{ width: '16px', height: '16px' }}
                onClick={handleClick}
                title={getPriorityText()}
                role="checkbox"
                aria-checked="false"
                data-testid={`task-completion-checkbox${testIdSuffix}`}
            />
        );
    }
};

export default TaskPriorityIcon;
