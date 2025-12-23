import React from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { SupporterTier, TIER_COLORS } from '../../types/supporter';

interface SupporterBadgeProps {
    tier: SupporterTier;
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    className?: string;
}

const SupporterBadge: React.FC<SupporterBadgeProps> = ({
    tier,
    size = 'medium',
    showLabel = false,
    className = '',
}) => {
    if (!tier) return null;

    const config = TIER_COLORS[tier];

    const sizeClasses = {
        small: 'h-4 w-4',
        medium: 'h-5 w-5',
        large: 'h-6 w-6',
    };

    const iconSize = sizeClasses[size] || sizeClasses.medium;

    if (showLabel) {
        return (
            <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color.bg} ${config.color.text} ${className}`}
                title={config.label}
            >
                <StarIcon className={`${iconSize} mr-1.5`} />
                {config.label}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center ${className}`}
            title={config.label}
        >
            <StarIcon className={`${iconSize} ${config.color.text}`} />
        </span>
    );
};

export default SupporterBadge;
