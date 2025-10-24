import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchMenu from './SearchMenu';

const UniversalSearch: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Listen for mobile search toggle events
    useEffect(() => {
        const handleMobileSearchToggle = (event: CustomEvent) => {
            setIsMobileSearchOpen(event.detail.isOpen);
            // On mobile, automatically open/close the search menu when mobile search is toggled
            if (window.innerWidth < 768) {
                setIsOpen(event.detail.isOpen);
            }
        };

        window.addEventListener(
            'mobileSearchToggle',
            handleMobileSearchToggle as EventListener
        );

        return () => {
            window.removeEventListener(
                'mobileSearchToggle',
                handleMobileSearchToggle as EventListener
            );
        };
    }, []);

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

    // Focus input when opening or when mobile search opens
    useEffect(() => {
        if ((isOpen || isMobileSearchOpen) && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, isMobileSearchOpen]);

    // Disable/enable body scroll when modal is open/closed
    useEffect(() => {
        const isModalOpen = isOpen || isMobileSearchOpen;

        if (isModalOpen) {
            // Disable body scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Re-enable body scroll
            document.body.style.overflow = '';
            // Hide soft keyboard on mobile when modal closes
            if (window.innerWidth < 768 && inputRef.current) {
                inputRef.current.blur();
            }
        }

        // Cleanup function to ensure scroll is re-enabled when component unmounts
        return () => {
            document.body.style.overflow = '';
            if (inputRef.current) {
                inputRef.current.blur();
            }
        };
    }, [isOpen, isMobileSearchOpen]);

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

            <div
                ref={searchRef}
                data-testid="universal-search"
                data-state={isOpen ? 'open' : 'closed'}
                className={`relative flex-1 mx-4 transition-all duration-300 ${
                    isOpen ? 'max-w-5xl' : 'max-w-3xl'
                }`}
            >
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
                        placeholder={t('search.placeholder')}
                        className="flex-1 ml-2 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={handleInputClick}
                        onBlur={() => {
                            // On mobile, hide search when input loses focus
                            if (window.innerWidth < 768) {
                                // md breakpoint
                                setIsOpen(false);
                                setSearchQuery(''); // Clear search query
                                setSelectedFilters([]); // Clear filters
                                // Dispatch event to close mobile search bar
                                window.dispatchEvent(
                                    new CustomEvent('closeMobileSearch')
                                );
                            }
                        }}
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
                        onClose={() => setIsOpen(false)}
                    />
                )}
            </div>
        </>
    );
};

export default UniversalSearch;
