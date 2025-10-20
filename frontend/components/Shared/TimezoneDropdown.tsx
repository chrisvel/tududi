import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { TimezoneOption } from '../../utils/timezoneUtils';

interface TimezoneDropdownProps {
    value: string;
    onChange: (timezone: string) => void;
    timezonesByRegion: Record<string, TimezoneOption[]>;
    getRegionDisplayName: (region: string) => string;
}

const TimezoneDropdown: React.FC<TimezoneDropdownProps> = ({
    value,
    onChange,
    timezonesByRegion,
    getRegionDisplayName,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Flatten all timezones into a single searchable list
    const allTimezones = useMemo(() => {
        const flattened: (TimezoneOption & { regionName: string })[] = [];
        Object.keys(timezonesByRegion).forEach((region) => {
            timezonesByRegion[region].forEach((tz) => {
                flattened.push({
                    ...tz,
                    regionName: getRegionDisplayName(region),
                });
            });
        });
        return flattened;
    }, [timezonesByRegion, getRegionDisplayName]);

    // Get the current timezone display label
    const selectedTimezone = useMemo(() => {
        if (value === 'UTC') return 'UTC';
        const found = allTimezones.find((tz) => tz.value === value);
        return found ? found.label : value;
    }, [value, allTimezones]);

    // Filter timezones based on search query
    const filteredTimezones = useMemo(() => {
        if (!searchQuery.trim()) return allTimezones;

        const query = searchQuery.toLowerCase();
        return allTimezones.filter(
            (tz) =>
                tz.label.toLowerCase().includes(query) ||
                tz.value.toLowerCase().includes(query) ||
                tz.regionName.toLowerCase().includes(query)
        );
    }, [searchQuery, allTimezones]);

    // Group filtered timezones by region
    const groupedFilteredTimezones = useMemo(() => {
        const grouped: Record<
            string,
            (TimezoneOption & { regionName: string })[]
        > = {};
        filteredTimezones.forEach((tz) => {
            if (!grouped[tz.regionName]) {
                grouped[tz.regionName] = [];
            }
            grouped[tz.regionName].push(tz);
        });
        return grouped;
    }, [filteredTimezones]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (timezone: string) => {
        onChange(timezone);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Dropdown trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between"
            >
                <span className="truncate">{selectedTimezone}</span>
                <ChevronDownIcon
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                        isOpen ? 'transform rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-96 overflow-hidden">
                    {/* Search input */}
                    <div className="sticky top-0 p-2 bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search timezones..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Timezone list */}
                    <div className="overflow-y-auto max-h-80">
                        {/* UTC option */}
                        {(!searchQuery ||
                            'utc'.includes(searchQuery.toLowerCase())) && (
                            <button
                                type="button"
                                onClick={() => handleSelect('UTC')}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                    value === 'UTC'
                                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                        : 'text-gray-900 dark:text-gray-100'
                                }`}
                            >
                                UTC
                            </button>
                        )}

                        {/* Grouped timezones */}
                        {Object.keys(groupedFilteredTimezones)
                            .sort()
                            .map((regionName) => (
                                <div key={regionName}>
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 sticky top-0">
                                        {regionName}
                                    </div>
                                    {groupedFilteredTimezones[regionName].map(
                                        (tz) => (
                                            <button
                                                key={tz.value}
                                                type="button"
                                                onClick={() =>
                                                    handleSelect(tz.value)
                                                }
                                                className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                                    value === tz.value
                                                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                                        : 'text-gray-900 dark:text-gray-100'
                                                }`}
                                            >
                                                {tz.label}
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}

                        {/* No results message */}
                        {filteredTimezones.length === 0 &&
                            searchQuery &&
                            'utc'.includes(searchQuery.toLowerCase()) ===
                                false && (
                                <div className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                                    No timezones found matching &quot;
                                    {searchQuery}&quot;
                                </div>
                            )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimezoneDropdown;
