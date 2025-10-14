import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import FilterBadge from './FilterBadge';
import SearchResults from './SearchResults';

interface SearchMenuProps {
    searchQuery: string;
    selectedFilters: string[];
    onFilterToggle: (filter: string) => void;
}

const filterTypes = [
    { name: 'Task', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { name: 'Project', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { name: 'Area', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { name: 'Note', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { name: 'Tag', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
];

const priorityOptions = [
    { value: 'high', label: 'high' },
    { value: 'medium', label: 'medium' },
    { value: 'low', label: 'low' },
];

const dueOptions = [
    { value: 'today', label: 'today' },
    { value: 'tomorrow', label: 'tomorrow' },
    { value: 'next_week', label: 'next week' },
    { value: 'next_month', label: 'next month' },
];

const SearchMenu: React.FC<SearchMenuProps> = ({
    searchQuery,
    selectedFilters,
    onFilterToggle,
}) => {
    const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
    const [selectedDue, setSelectedDue] = useState<string | null>(null);

    const handlePriorityToggle = (priority: string) => {
        setSelectedPriority(selectedPriority === priority ? null : priority);
    };

    const handleDueToggle = (due: string) => {
        setSelectedDue(selectedDue === due ? null : due);
    };

    const buildSearchDescription = () => {
        const parts: React.ReactNode[] = [];

        // Build entity types part
        if (selectedFilters.length > 0) {
            const entities = selectedFilters.map((f) => (
                <span key={f} style={{ fontWeight: 800, fontStyle: 'normal' }}>{f.toLowerCase()}s</span>
            ));
            const entitiesWithSeparators: React.ReactNode[] = [];
            entities.forEach((entity, index) => {
                if (index > 0) {
                    entitiesWithSeparators.push(' and ');
                }
                entitiesWithSeparators.push(entity);
            });
            parts.push(...entitiesWithSeparators);
        }

        // Add search query
        if (searchQuery.trim()) {
            if (parts.length > 0) {
                parts.push(', containing the text ');
            } else {
                parts.push('Searching for items containing ');
            }
            parts.push(<span key="query" style={{ fontWeight: 800, fontStyle: 'normal' }}>"{searchQuery.trim()}"</span>);
        }

        // Add priority filter
        if (selectedPriority) {
            parts.push(', with ');
            parts.push(<span key="priority" style={{ fontWeight: 800, fontStyle: 'normal' }}>{selectedPriority}</span>);
            parts.push(' priority');
        }

        // Add due date filter
        if (selectedDue) {
            const dueLabel = dueOptions.find((opt) => opt.value === selectedDue)?.label || selectedDue;
            parts.push(', due ');
            parts.push(<span key="due" style={{ fontWeight: 800, fontStyle: 'normal' }}>{dueLabel}</span>);
        }

        if (parts.length === 0) return null;

        // Construct the sentence
        return (
            <>
                {selectedFilters.length > 0 ? 'You are searching for ' : ''}
                {parts}
            </>
        );
    };

    const searchDescription = buildSearchDescription();
    const hasActiveFilters = selectedFilters.length > 0 || searchQuery.trim() || selectedPriority || selectedDue;

    return (
        <div className="fixed left-1/2 transform -translate-x-1/2 top-20 w-[90vw] max-w-4xl h-[80vh] max-h-[700px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col">
            {/* Filter Badges Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                {/* Search Description */}
                {hasActiveFilters && searchDescription && (
                    <>
                        <div className="mb-3 flex items-center gap-3 px-3 py-3">
                            <InformationCircleIcon className="h-6 w-6 text-black/30 dark:text-white/30 flex-shrink-0" />
                            <p className="text-xl text-black/40 dark:text-white/40 flex-1" style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic' }}>
                                {searchDescription}
                            </p>
                        </div>
                        <div className="mb-3 border-t border-gray-300 dark:border-gray-600"></div>
                    </>
                )}

                {/* Entity Type Badges */}
                <div className="flex flex-wrap gap-2">
                    {filterTypes.map((filter) => {
                        const isSelected = selectedFilters.includes(filter.name);
                        return (
                            <FilterBadge
                                key={filter.name}
                                name={filter.name}
                                color={filter.color}
                                isSelected={isSelected}
                                onToggle={() => onFilterToggle(filter.name)}
                            />
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>

                {/* Metadata Filters */}
                <div className="space-y-3">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        Metadata Filters
                    </div>

                    {/* Priority Filters */}
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            Priority
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {priorityOptions.map((option) => (
                                <FilterBadge
                                    key={option.value}
                                    name={option.label}
                                    isSelected={selectedPriority === option.value}
                                    onToggle={() => handlePriorityToggle(option.value)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Due Date Filters */}
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            Due
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dueOptions.map((option) => (
                                <FilterBadge
                                    key={option.value}
                                    name={option.label}
                                    isSelected={selectedDue === option.value}
                                    onToggle={() => handleDueToggle(option.value)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Results */}
            <SearchResults
                searchQuery={searchQuery}
                selectedFilters={selectedFilters}
                selectedPriority={selectedPriority}
                selectedDue={selectedDue}
            />
        </div>
    );
};

export default SearchMenu;
