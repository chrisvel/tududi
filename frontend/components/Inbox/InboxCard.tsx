import React from 'react';

interface InboxCardProps {
    children: React.ReactNode;
    className?: string;
    isActive?: boolean;
    onClick?: () => void;
}

const InboxCard: React.FC<InboxCardProps> = ({
    children,
    className = '',
    isActive = false,
    onClick,
}) => {
    const interactiveClasses = onClick ? 'cursor-pointer' : '';
    const activeClasses = isActive
        ? 'ring-2 ring-blue-500 shadow-md'
        : 'hover:shadow-md';

    return (
        <div
            onClick={onClick}
            className={`w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm transition-shadow duration-200 ${activeClasses} ${interactiveClasses} ${className}`}
        >
            {children}
        </div>
    );
};

export default InboxCard;
