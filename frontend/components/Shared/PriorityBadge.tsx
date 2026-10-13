import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    FireIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';

export type PriorityLevel = 'low' | 'medium' | 'high';

export const toPriorityLevel = (
    priority: Task['priority'] | number | null | undefined
): PriorityLevel | null => {
    const p =
        typeof priority === 'number'
            ? (['low', 'medium', 'high'] as const)[priority]
            : priority;
    return p === 'low' || p === 'medium' || p === 'high' ? p : null;
};

// Same icons and hues as the priority dropdown, on a soft tint.
const STYLES: Record<
    PriorityLevel,
    { Icon: typeof FireIcon; tone: string; labelKey: string; label: string }
> = {
    low: {
        Icon: ArrowDownIcon,
        tone: 'bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-300',
        labelKey: 'priority.low',
        label: 'Low',
    },
    medium: {
        Icon: ArrowUpIcon,
        tone: 'bg-orange-50 text-orange-600 dark:bg-orange-900/25 dark:text-orange-300',
        labelKey: 'priority.medium',
        label: 'Medium',
    },
    high: {
        Icon: FireIcon,
        tone: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-300',
        labelKey: 'priority.high',
        label: 'High',
    },
};

interface PriorityBadgeProps {
    priority: Task['priority'] | number | null | undefined;
    // 'sm' sits in a task row's details line; 'md' matches the expanded
    // row's toolbar buttons.
    size?: 'sm' | 'md';
    className?: string;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({
    priority,
    size = 'sm',
    className = '',
}) => {
    const { t } = useTranslation();
    const level = toPriorityLevel(priority);
    if (!level) return null;
    const { Icon, tone, labelKey, label } = STYLES[level];
    const sizing =
        size === 'md'
            ? 'h-8 px-2 gap-1 rounded-md text-xs'
            : 'h-[18px] px-1.5 gap-0.5 rounded-full text-[10.5px]';
    return (
        <span
            className={`inline-flex items-center font-medium whitespace-nowrap ${sizing} ${tone} ${className}`}
        >
            <Icon
                className={size === 'md' ? 'h-4 w-4' : 'h-3 w-3'}
                aria-hidden="true"
            />
            {t(labelKey, label)}
        </span>
    );
};

export default PriorityBadge;
