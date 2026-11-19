import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { FilterOption } from './FilterDropdown';

interface MultiFilterDropdownProps {
    options: FilterOption[];
    values: string[];
    onChange: (values: string[]) => void;
    // Button text with nothing picked; also the accessible name.
    placeholder: string;
    // A search box at the top of the menu narrows the options by label
    searchable?: boolean;
    className?: string;
}

/**
 * Multi-choice counterpart of FilterDropdown: same button, menu and search
 * box, with a checkbox per option (as in the Kanban column settings). The
 * menu stays open while options are toggled.
 */
const MultiFilterDropdown: React.FC<MultiFilterDropdownProps> = ({
    options,
    values,
    onChange,
    placeholder,
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

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const query = search.trim().toLowerCase();
    const visibleOptions = query
        ? options.filter((option) => option.label.toLowerCase().includes(query))
        : options;

    const toggle = (value: string) => {
        onChange(
            values.includes(value)
                ? values.filter((v) => v !== value)
                : [...values, value]
        );
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={placeholder}
                className="inline-flex justify-between items-center gap-2 w-44 rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 text-sm bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate min-w-0">{placeholder}</span>
                <span className="flex items-center gap-1 flex-shrink-0">
                    {values.length > 0 && (
                        <span className="rounded-full bg-gray-200 dark:bg-gray-600 px-1.5 text-xs">
                            {values.length}
                        </span>
                    )}
                    <ChevronDownIcon
                        className={`h-4 w-4 text-gray-500 dark:text-gray-300 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                        }`}
                    />
                </span>
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-1 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50">
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
                            />
                        </div>
                    )}
                    <div
                        role="listbox"
                        aria-multiselectable="true"
                        aria-label={placeholder}
                        className="p-1 max-h-60 overflow-y-auto"
                    >
                        {visibleOptions.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                {t('search.noResults', 'No results found')}
                            </div>
                        )}
                        {visibleOptions.map((option) => (
                            <label
                                key={option.value}
                                role="option"
                                aria-selected={values.includes(option.value)}
                                className="flex items-center gap-2.5 px-3 py-1.5 rounded cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                            >
                                <input
                                    type="checkbox"
                                    checked={values.includes(option.value)}
                                    onChange={() => toggle(option.value)}
                                    className="w-3.5 h-3.5 rounded accent-gray-600"
                                />
                                <span className="truncate">{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiFilterDropdown;
