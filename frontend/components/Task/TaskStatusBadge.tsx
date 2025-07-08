import React from 'react';
import {
    MinusIcon,
    CheckCircleIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { StatusType } from '../../entities/Task';

interface TaskStatusBadgeProps {
    status: StatusType | number;
    className?: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({
    status,
    className,
}) => {
    // Convert numeric status to string
    const getStatusString = (status: StatusType | number): StatusType => {
        if (typeof status === 'number') {
            const statusNames: StatusType[] = [
                'not_started',
                'in_progress',
                'done',
                'archived',
            ];
            return statusNames[status] || 'not_started';
        }
        return status;
    };

    const statusString = getStatusString(status);
    let statusIcon;

    switch (statusString) {
        case 'not_started':
            statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
            break;
        case 'in_progress':
            statusIcon = <ArrowPathIcon className="h-4 w-4 text-blue-400" />;
            break;
        case 'done':
            statusIcon = <CheckCircleIcon className="h-4 w-4 text-green-400" />;
            break;
        case 'archived':
            statusIcon = <ArchiveBoxIcon className="h-4 w-4 text-gray-400" />;
            break;
        default:
            statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
    }

    return (
        <div className={`flex items-center md:px-2 ${className}`}>
            {statusIcon}
            {/* <span className="ml-2 text-xs font-medium inline md:hidden">{statusLabel}</span> */}
        </div>
    );
};

export default TaskStatusBadge;
