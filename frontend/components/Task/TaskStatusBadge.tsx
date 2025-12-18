import React from 'react';
import {
    MinusIcon,
    CheckCircleIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
    ClockIcon,
    XCircleIcon,
    CalendarIcon,
} from '@heroicons/react/24/solid';
import { StatusType } from '../../entities/Task';
import { getStatusString } from '../../constants/taskStatus';

interface TaskStatusBadgeProps {
    status: StatusType | number;
    className?: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({
    status,
    className,
}) => {
    const statusString = getStatusString(status);
    let statusIcon;

    switch (statusString) {
        case 'not_started':
            statusIcon = <MinusIcon className="h-4 w-4 text-gray-400" />;
            break;
        case 'planned':
            statusIcon = <CalendarIcon className="h-4 w-4 text-purple-400" />;
            break;
        case 'in_progress':
            statusIcon = <ArrowPathIcon className="h-4 w-4 text-blue-400" />;
            break;
        case 'waiting':
            statusIcon = <ClockIcon className="h-4 w-4 text-yellow-400" />;
            break;
        case 'done':
            statusIcon = <CheckCircleIcon className="h-4 w-4 text-green-400" />;
            break;
        case 'cancelled':
            statusIcon = <XCircleIcon className="h-4 w-4 text-red-400" />;
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
