import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MagnifyingGlassIcon,
    InformationCircleIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import { SortOption } from './SortFilterButton';

export interface ViewOptionsBarProps {
    // Info/Description
    showInfo?: boolean;
    onToggleInfo?: () => void;
    isInfoExpanded?: boolean;

    // Search
    showSearch?: boolean;
    onToggleSearch?: () => void;
    isSearchExpanded?: boolean;

    // Show Completed Toggle
    showCompletedToggle?: boolean;
    showCompleted?: boolean;
    onToggleCompleted?: () => void;
    completedLabel?: string;

    // Sort/Filter Dropdown
    showSort?: boolean;
    sortOptions?: SortOption[];
    sortValue?: string;
    onSortChange?: (value: string) => void;
    sortLabel?: string;

    // Custom buttons/elements to add
    customElements?: React.ReactNode;

    // Styling
    className?: string;
    position?: 'fixed' | 'relative'; // For upcoming view in Tasks
    fixedPosition?: string; // Custom position classes for fixed positioning
}

const ViewOptionsBar: React.FC<ViewOptionsBarProps> = ({
    showInfo = false,
    onToggleInfo,
    isInfoExpanded = false,
    showSearch = false,
    onToggleSearch,
    isSearchExpanded = false,
    showCompletedToggle = false,
    showCompleted = false,
    onToggleCompleted,
    completedLabel,
    showSort = false,
    sortOptions = [],
    sortValue = '',
    onSortChange,
    sortLabel,
    customElements,
    className = '',
    position = 'relative',
    fixedPosition = '',
}) => {
    const { t } = useTranslation();
    const [isSortDropdownOpen, setIsSortDropdownOpen] = React.useState(false);
    const sortDropdownRef = useRef<HTMLDivElement>(null);

    // Close sort dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                sortDropdownRef.current &&
                !sortDropdownRef.current.contains(event.target as Node)
            ) {
                setIsSortDropdownOpen(false);
            }
        };

        if (isSortDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isSortDropdownOpen]);

    const handleSortSelect = (value: string) => {
        if (onSortChange) {
            onSortChange(value);
        }
        setIsSortDropdownOpen(false);
    };

    const containerClasses =
        position === 'fixed'
            ? `${fixedPosition} z-20 ${className}`
            : `flex items-center gap-2 ${className}`;

    return (
        <div className={containerClasses}>
            {/* Info Button */}
            {showInfo && onToggleInfo && (
                <button
                    onClick={onToggleInfo}
                    className={`flex items-center hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg${isInfoExpanded ? ' bg-blue-50/70 dark:bg-blue-900/20' : ''} p-2`}
                    aria-expanded={isInfoExpanded}
                    aria-label={
                        isInfoExpanded
                            ? t('common.hideInfo', 'Hide info')
                            : t('common.showInfo', 'Show info')
                    }
                    title={
                        isInfoExpanded
                            ? t('common.hideInfo', 'Hide info')
                            : t('common.aboutView', 'About this view')
                    }
                >
                    <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                    <span className="sr-only">
                        {isInfoExpanded
                            ? t('common.hideInfo', 'Hide info')
                            : t('common.aboutView', 'About this view')}
                    </span>
                </button>
            )}

            {/* Search Button */}
            {showSearch && onToggleSearch && (
                <button
                    onClick={onToggleSearch}
                    className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                        isSearchExpanded
                            ? 'bg-blue-50/70 dark:bg-blue-900/20'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    aria-expanded={isSearchExpanded}
                    aria-label={
                        isSearchExpanded
                            ? t('common.hideSearch', 'Hide search')
                            : t('common.showSearch', 'Show search')
                    }
                    title={
                        isSearchExpanded
                            ? t('common.hideSearch', 'Hide search')
                            : t('common.search', 'Search')
                    }
                >
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                    <span className="sr-only">
                        {isSearchExpanded
                            ? t('common.hideSearch', 'Hide search')
                            : t('common.search', 'Search')}
                    </span>
                </button>
            )}

            {/* Show Completed Toggle */}
            {showCompletedToggle && onToggleCompleted && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {completedLabel ||
                            t('common.showCompleted', 'Show completed')}
                    </span>
                    <button
                        onClick={onToggleCompleted}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            showCompleted
                                ? 'bg-blue-600'
                                : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                        aria-pressed={showCompleted}
                        aria-label={
                            showCompleted
                                ? t('common.hideCompleted', 'Hide completed')
                                : t('common.showCompleted', 'Show completed')
                        }
                        title={
                            showCompleted
                                ? t('common.hideCompleted', 'Hide completed')
                                : t('common.showCompleted', 'Show completed')
                        }
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                showCompleted
                                    ? 'translate-x-4'
                                    : 'translate-x-0.5'
                            }`}
                        />
                    </button>
                </div>
            )}

            {/* Sort/Filter Dropdown */}
            {showSort && sortOptions.length > 0 && onSortChange && (
                <div className="relative" ref={sortDropdownRef}>
                    <button
                        onClick={() =>
                            setIsSortDropdownOpen(!isSortDropdownOpen)
                        }
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={
                            sortLabel ||
                            t('common.sortFilter', 'Sort and filter')
                        }
                        title={
                            sortLabel ||
                            t('common.sortFilter', 'Sort and filter')
                        }
                    >
                        <FunnelIcon className="h-5 w-5" />
                    </button>
                    {isSortDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                {sortLabel || t('common.sortBy', 'Sort by')}
                            </div>
                            <div className="py-1">
                                {sortOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() =>
                                            handleSortSelect(option.value)
                                        }
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                            sortValue === option.value
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Custom Elements */}
            {customElements}
        </div>
    );
};

export default ViewOptionsBar;
