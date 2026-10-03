import React from 'react';

export type CalloutType = 'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT' | 'DANGER';

interface CalloutConfig {
    borderClass: string;
    bgClass: string;
    headerClass: string;
    icon: string;
    defaultLabel: string;
}

export const CALLOUT_CONFIG: Record<CalloutType, CalloutConfig> = {
    NOTE: {
        borderClass: 'border-gray-300 dark:border-gray-600',
        bgClass: 'bg-gray-50 dark:bg-gray-800/50',
        headerClass: 'text-gray-800 dark:text-gray-100',
        icon: 'ℹ️',
        defaultLabel: 'Note',
    },
    TIP: {
        borderClass: 'border-gray-300 dark:border-gray-600',
        bgClass: 'bg-gray-50 dark:bg-gray-800/50',
        headerClass: 'text-gray-800 dark:text-gray-100',
        icon: '💡',
        defaultLabel: 'Tip',
    },
    WARNING: {
        borderClass: 'border-gray-300 dark:border-gray-600',
        bgClass: 'bg-gray-50 dark:bg-gray-800/50',
        headerClass: 'text-gray-800 dark:text-gray-100',
        icon: '⚠️',
        defaultLabel: 'Warning',
    },
    IMPORTANT: {
        borderClass: 'border-gray-300 dark:border-gray-600',
        bgClass: 'bg-gray-50 dark:bg-gray-800/50',
        headerClass: 'text-gray-800 dark:text-gray-100',
        icon: '📌',
        defaultLabel: 'Important',
    },
    DANGER: {
        borderClass: 'border-gray-300 dark:border-gray-600',
        bgClass: 'bg-gray-50 dark:bg-gray-800/50',
        headerClass: 'text-gray-800 dark:text-gray-100',
        icon: '🔥',
        defaultLabel: 'Danger',
    },
};

interface CalloutBlockProps {
    type: CalloutType;
    title?: string;
    children?: React.ReactNode;
}

const CalloutBlock: React.FC<CalloutBlockProps> = ({ type, title, children }) => {
    const config = CALLOUT_CONFIG[type] ?? CALLOUT_CONFIG.NOTE;

    return (
        <div
            className={`callout callout-${type.toLowerCase()} rounded-lg border-l-4 ${config.borderClass} ${config.bgClass} px-4 py-3 my-4 not-prose`}
        >
            <div className={`flex items-center gap-1.5 font-semibold text-sm mb-1 ${config.headerClass}`}>
                <span role="img" aria-hidden="true">{config.icon}</span>
                <span>{title || config.defaultLabel}</span>
            </div>
            {children && (
                <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed [&>p:last-child]:mb-0">
                    {children}
                </div>
            )}
        </div>
    );
};

export default CalloutBlock;
