import React, { useState, useRef, useEffect } from 'react';
import { FunnelIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface SortOption {
    value: string;
    label: string;
}

interface SortFilterButtonProps {
    options: SortOption[];
    value: string;
    onChange: (value: string) => void;
    size?: 'mobile' | 'desktop';
    className?: string;
}

const SortFilterButton: React.FC<SortFilterButtonProps> = ({
    options,
    value,
    onChange,
    size = 'desktop',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedOption = options.find((option) => option.value === value);
    const isMobile = size === 'mobile';

    // Calculate optimal width based on the longest option text
    const longestOptionLength = Math.max(
        ...options.map((option) => option.label.length)
    );
    const optimalWidth = isMobile
        ? Math.max(longestOptionLength * 0.45 + 2.5, 6.5) // min 6.5rem for mobile
        : Math.max(longestOptionLength * 0.55 + 3.5, 8.5); // min 8.5rem for desktop

    const buttonClasses = isMobile
        ? `inline-flex justify-between items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-1.5 bg-white dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors`
        : `inline-flex justify-between items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors`;

    const buttonStyle = { width: `${optimalWidth}rem` };

    const iconSize = isMobile ? 'h-3 w-3' : 'h-4 w-4';
    const iconMargin = isMobile ? 'mr-1' : 'mr-2';
    const textSize = isMobile ? 'text-xs' : 'text-sm';
    const arrowMargin = isMobile ? 'ml-1' : 'ml-2';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                className={buttonClasses}
                style={buttonStyle}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center">
                    <FunnelIcon className={`${iconSize} ${iconMargin}`} />
                    <span className="whitespace-nowrap">
                        {selectedOption?.label || 'Created at'}
                    </span>
                </div>
                <span className={`${textSize} ${arrowMargin}`}>
                    {value?.includes(':desc') ? '↓' : '↑'}
                </span>
            </button>
            {isOpen && (
                <div
                    className={`origin-top-right absolute right-0 mt-1 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50`}
                    style={buttonStyle}
                >
                    <div className="p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`block ${isMobile ? 'px-4 py-2 text-xs' : 'px-4 py-2 text-sm'} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left`}
                            >
                                <span className="flex items-center justify-between">
                                    <span>{option.label}</span>
                                    {value === option.value && (
                                        <CheckIcon className={iconSize} />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SortFilterButton;
