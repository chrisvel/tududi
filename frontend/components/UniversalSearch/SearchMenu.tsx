import React, { useState } from 'react';
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

const SearchMenu: React.FC<SearchMenuProps> = ({
    searchQuery,
    selectedFilters,
    onFilterToggle,
}) => {
    const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

    const handlePriorityToggle = (priority: string) => {
        setSelectedPriority(selectedPriority === priority ? null : priority);
    };

    return (
        <div className="fixed left-1/2 transform -translate-x-1/2 top-20 w-[90vw] max-w-4xl h-[80vh] max-h-[700px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col">
            {/* Filter Badges Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        Metadata Filters
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {priorityOptions.map((option) => (
                            <FilterBadge
                                key={option.value}
                                name={`priority:${option.label}`}
                                isSelected={selectedPriority === option.value}
                                onToggle={() => handlePriorityToggle(option.value)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Search Results */}
            <SearchResults
                searchQuery={searchQuery}
                selectedFilters={selectedFilters}
                selectedPriority={selectedPriority}
            />
        </div>
    );
};

export default SearchMenu;
