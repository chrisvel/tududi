import React from 'react';

interface FilterBadgeProps {
    name: string;
    color?: string;
    isSelected: boolean;
    onToggle: () => void;
}

const FilterBadge: React.FC<FilterBadgeProps> = ({
    name,
    color,
    isSelected,
    onToggle,
}) => {
    // Default colorless badge style
    const defaultColor =
        'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    const badgeColor = color || defaultColor;

    // Map light background colors to darker border colors
    const getBorderColor = (bgColor: string) => {
        const colorMap: Record<string, string> = {
            'bg-blue-100': 'border-blue-300 dark:border-blue-700',
            'bg-purple-100': 'border-purple-300 dark:border-purple-700',
            'bg-green-100': 'border-green-300 dark:border-green-700',
            'bg-yellow-100': 'border-yellow-300 dark:border-yellow-700',
            'bg-pink-100': 'border-pink-300 dark:border-pink-700',
            'bg-gray-200': 'border-gray-400 dark:border-gray-500',
        };

        // Extract the bg-color from the full color string
        const bgColorClass = bgColor.split(' ')[0];
        return colorMap[bgColorClass] || 'border-gray-400 dark:border-gray-500';
    };

    const borderColor = getBorderColor(badgeColor);

    return (
        <button
            onClick={onToggle}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isSelected
                    ? badgeColor
                    : `border border-solid ${borderColor} ${badgeColor.split(' ').slice(1).join(' ')} bg-transparent opacity-50 hover:opacity-100`
            }`}
        >
            {name}
        </button>
    );
};

export default FilterBadge;
