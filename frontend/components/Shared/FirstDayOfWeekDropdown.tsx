import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface WeekdayOption {
    value: number;
    label: string;
    translationKey: string;
}

interface FirstDayOfWeekDropdownProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

const FirstDayOfWeekDropdown: React.FC<FirstDayOfWeekDropdownProps> = ({
    value,
    onChange,
    className = '',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const weekdays: WeekdayOption[] = [
        {
            value: 0,
            label: t('weekdaysFull.sunday', 'Sunday'),
            translationKey: 'weekdaysFull.sunday',
        },
        {
            value: 1,
            label: t('weekdaysFull.monday', 'Monday'),
            translationKey: 'weekdaysFull.monday',
        },
        {
            value: 2,
            label: t('weekdaysFull.tuesday', 'Tuesday'),
            translationKey: 'weekdaysFull.tuesday',
        },
        {
            value: 3,
            label: t('weekdaysFull.wednesday', 'Wednesday'),
            translationKey: 'weekdaysFull.wednesday',
        },
        {
            value: 4,
            label: t('weekdaysFull.thursday', 'Thursday'),
            translationKey: 'weekdaysFull.thursday',
        },
        {
            value: 5,
            label: t('weekdaysFull.friday', 'Friday'),
            translationKey: 'weekdaysFull.friday',
        },
        {
            value: 6,
            label: t('weekdaysFull.saturday', 'Saturday'),
            translationKey: 'weekdaysFull.saturday',
        },
    ];

    const selectedWeekday =
        weekdays.find((day) => day.value === value) || weekdays[1]; // Default to Monday

    useEffect(() => {
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
    }, []);

    const handleSelect = (weekday: WeekdayOption) => {
        onChange(weekday.value);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between text-sm font-medium"
            >
                <span>{selectedWeekday.label}</span>
                <ChevronDownIcon
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div
                    className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
                    role="listbox"
                >
                    {weekdays.map((weekday) => (
                        <button
                            key={weekday.value}
                            type="button"
                            onClick={() => handleSelect(weekday)}
                            role="option"
                            aria-selected={value === weekday.value}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150 ${
                                weekday.value === value
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-900 dark:text-gray-100'
                            }`}
                        >
                            <span>{weekday.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FirstDayOfWeekDropdown;
