import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchMenu from './SearchMenu';

interface UniversalSearchProps {
    isDarkMode: boolean;
}

const UniversalSearch: React.FC<UniversalSearchProps> = ({ isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close on clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                searchRef.current &&
                !searchRef.current.contains(event.target as Node)
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

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleInputClick = () => {
        setIsOpen(true);
    };

    const handleFilterToggle = (filter: string) => {
        setSelectedFilters((prev) =>
            prev.includes(filter)
                ? prev.filter((f) => f !== filter)
                : [...prev, filter]
        );
    };

    return (
        <>
            {/* Backdrop Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div ref={searchRef} className="relative flex-1 max-w-xl mx-4">
                {/* Search Bar */}
                <div
                    className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 transition-all ${
                        isOpen ? 'ring-2 ring-blue-500 relative z-50' : ''
                    }`}
                >
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search tasks, projects, notes..."
                        className="flex-1 ml-2 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={handleInputClick}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Search Menu Dropdown */}
                {isOpen && (
                    <SearchMenu
                        searchQuery={searchQuery}
                        selectedFilters={selectedFilters}
                        onFilterToggle={handleFilterToggle}
                    />
                )}
            </div>
        </>
    );
};

export default UniversalSearch;
