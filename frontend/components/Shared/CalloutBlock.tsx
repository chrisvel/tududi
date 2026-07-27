import React from 'react';

export type CalloutType = 'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT' | 'DANGER';

interface CalloutConfig {
    borderClass: string;
    bgClass: string;
    headerClass: string;
    icon: string;
    defaultLabel: string;
}

const CALLOUT_CONFIG: Record<CalloutType, CalloutConfig> = {
    NOTE: {
        borderClass: 'border-blue-400 dark:border-blue-500',
        bgClass: 'bg-blue-50 dark:bg-blue-950/30',
        headerClass: 'text-blue-700 dark:text-blue-300',
        icon: 'ℹ️',
        defaultLabel: 'Note',
    },
    TIP: {
        borderClass: 'border-green-400 dark:border-green-500',
        bgClass: 'bg-green-50 dark:bg-green-950/30',
        headerClass: 'text-green-700 dark:text-green-300',
        icon: '💡',
        defaultLabel: 'Tip',
    },
    WARNING: {
        borderClass: 'border-amber-400 dark:border-amber-500',
        bgClass: 'bg-amber-50 dark:bg-amber-950/30',
        headerClass: 'text-amber-700 dark:text-amber-300',
        icon: '⚠️',
        defaultLabel: 'Warning',
    },
    IMPORTANT: {
        borderClass: 'border-purple-400 dark:border-purple-500',
        bgClass: 'bg-purple-50 dark:bg-purple-950/30',
        headerClass: 'text-purple-700 dark:text-purple-300',
        icon: '📌',
        defaultLabel: 'Important',
    },
    DANGER: {
        borderClass: 'border-red-400 dark:border-red-500',
        bgClass: 'bg-red-50 dark:bg-red-950/30',
        headerClass: 'text-red-700 dark:text-red-300',
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
