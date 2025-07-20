import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface FilterOption {
    value: string;
    label: string;
}

interface FilterDropdownProps {
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    size?: 'mobile' | 'desktop';
    autoWidth?: boolean;
    className?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    size = 'desktop',
    autoWidth = false,
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

    // Calculate width based on longest option if autoWidth is enabled
    const getMinWidth = () => {
        if (!autoWidth) return {};

        const longestLabel = options.reduce(
            (longest, option) =>
                option.label.length > longest.length ? option.label : longest,
            ''
        );

        // More accurate width calculation:
        // - Character width: ~6px for text-xs, ~7px for text-sm
        // - Padding: 12px left + 16px right (px-3 = 12px, px-4 = 16px)
        // - Icon space: ~20px for chevron icon
        const charWidth = isMobile ? 6 : 7;
        const padding = isMobile ? 24 : 32; // px-3 py-1.5 vs px-4 py-2
        const iconSpace = 20;
        const estimatedWidth =
            longestLabel.length * charWidth + padding + iconSpace;

        return { minWidth: `${estimatedWidth}px` };
    };

    const dynamicStyles = getMinWidth();
    const widthClass = autoWidth ? '' : isMobile ? 'w-32' : 'w-40';

    const buttonClasses = `inline-flex justify-between items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors ${widthClass}`;

    const iconSize = isMobile ? 'h-3 w-3' : 'h-4 w-4';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                className={buttonClasses}
                style={dynamicStyles}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="whitespace-nowrap">
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDownIcon
                    className={`${iconSize} text-gray-500 dark:text-gray-300 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>
            {isOpen && (
                <div
                    className={`origin-top-right absolute right-0 mt-1 ${!autoWidth ? (isMobile ? 'w-36' : 'w-40') : ''} rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50`}
                    style={autoWidth ? dynamicStyles : {}}
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
                                        <CheckIcon
                                            className={`${iconSize} ml-2`}
                                        />
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

export default FilterDropdown;
