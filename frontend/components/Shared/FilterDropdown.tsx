import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    // Takes its share of a row on phones, cutting long labels short; a
    // fixed width from sm up. The menu still shows labels in full.
    fill?: boolean;
    // Fills its container at every width, menu included, and keeps a long
    // menu scrollable (for forms and popovers)
    fullWidth?: boolean;
    // A search box at the top of the menu narrows the options by label
    searchable?: boolean;
    className?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    size = 'desktop',
    autoWidth = false,
    fill = false,
    fullWidth = false,
    searchable = false,
    className = '',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // A fresh search each time the menu opens, with the box ready to type in
    useEffect(() => {
        if (!isOpen) return;
        setSearch('');
        if (searchable) searchRef.current?.focus();
    }, [isOpen, searchable]);

    const query = search.trim().toLowerCase();
    const visibleOptions =
        searchable && query
            ? options.filter(
                  (option) =>
                      option.value !== 'divider' &&
                      option.label.toLowerCase().includes(query)
              )
            : options;

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
    const widthClass = fullWidth
        ? 'w-full gap-1'
        : autoWidth
          ? ''
          : isMobile
            ? 'w-32'
            : 'w-40';

    const buttonClasses = `inline-flex justify-between items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm ${isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors ${fill ? 'w-full sm:w-44 gap-1' : widthClass}`;

    const iconSize = isMobile ? 'h-3 w-3' : 'h-4 w-4';

    return (
        <div
            className={`relative ${fill ? 'flex-1 min-w-0 sm:flex-none' : ''} ${className}`}
            ref={dropdownRef}
        >
            <button
                type="button"
                className={buttonClasses}
                style={fill || fullWidth ? undefined : dynamicStyles}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span
                    className={
                        fill || fullWidth
                            ? 'truncate min-w-0'
                            : 'whitespace-nowrap'
                    }
                >
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDownIcon
                    className={`${iconSize} flex-shrink-0 text-gray-500 dark:text-gray-300 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>
            {isOpen && (
                <div
                    className={`origin-top-right absolute right-0 mt-1 ${fill ? 'min-w-full' : ''} ${fullWidth ? 'left-0 w-full' : !autoWidth ? (isMobile ? 'w-36' : 'w-40') : ''} rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50`}
                    style={autoWidth && !fullWidth ? dynamicStyles : {}}
                >
                    {searchable && (
                        <div className="p-1 pb-0">
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.stopPropagation();
                                        setIsOpen(false);
                                    }
                                }}
                                placeholder={t('common.search', 'Search')}
                                aria-label={t('common.search', 'Search')}
                                className="w-full rounded bg-gray-100 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                data-testid="filter-dropdown-search"
                            />
                        </div>
                    )}
                    <div
                        className={`p-1${fullWidth ? ' max-h-60 overflow-y-auto' : ''}`}
                    >
                        {visibleOptions.length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                {t('search.noResults', 'No results found')}
                            </div>
                        )}
                        {visibleOptions.map((option, index) =>
                            option.value === 'divider' ? (
                                <div
                                    key={`divider-${index}`}
                                    className="my-1 -mx-1 border-t border-gray-100 dark:border-gray-700"
                                />
                            ) : (
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
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterDropdown;
