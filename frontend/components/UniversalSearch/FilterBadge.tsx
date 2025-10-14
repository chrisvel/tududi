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
    const defaultColor = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    const badgeColor = color || defaultColor;

    return (
        <button
            onClick={onToggle}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isSelected
                    ? badgeColor
                    : `border-2 border-dashed ${badgeColor.replace('bg-', 'border-').replace('text-', 'text-')} opacity-50 hover:opacity-100`
            }`}
        >
            {name}
        </button>
    );
};

export default FilterBadge;
