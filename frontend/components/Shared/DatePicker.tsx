import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select date',
    disabled = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
        width: 0,
        openUpward: false,
    });
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(0); // 0 = Sunday, 1 = Monday, etc.
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];

    // Generate days array based on first day of week setting
    const getAllDays = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const getDaysOfWeek = () => {
        const allDays = getAllDays();
        return [
            ...allDays.slice(firstDayOfWeek),
            ...allDays.slice(0, firstDayOfWeek),
        ];
    };

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDate = (dateString: string) => {
        return dateString ? new Date(dateString + 'T00:00:00') : null;
    };

    const formatDisplayDate = (dateString: string) => {
        if (!dateString) return placeholder;
        const date = parseDate(dateString);
        if (!date || isNaN(date.getTime())) return placeholder;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleToggle = () => {
        if (disabled) return;

        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = 320; // Calendar height
            const padding = 16; // Extra padding from viewport edges

            // Determine if we should open upward
            const wouldFitBelow = spaceBelow >= menuHeight + padding;
            const wouldFitAbove = spaceAbove >= menuHeight + padding;

            let openUpward = false;
            let top = rect.bottom + 8;

            if (!wouldFitBelow && wouldFitAbove) {
                // Open upward if it fits above but not below
                openUpward = true;
                top = rect.top - menuHeight - 8;
            } else if (!wouldFitBelow && !wouldFitAbove) {
                // If it doesn't fit in either direction, choose the side with more space
                if (spaceAbove > spaceBelow) {
                    openUpward = true;
                    top = Math.max(padding, rect.top - menuHeight - 8);
                } else {
                    top = Math.min(
                        window.innerHeight - menuHeight - padding,
                        rect.bottom + 8
                    );
                }
            }

            // Ensure left position doesn't go off screen
            const calendarWidth = Math.min(Math.max(rect.width, 280), 320); // Min 280px, max 320px
            const left = Math.min(
                Math.max(padding, rect.left),
                window.innerWidth - calendarWidth - padding
            );

            setPosition({
                top,
                left,
                width: calendarWidth,
                openUpward,
            });

            // Set current month based on selected date or today
            if (value) {
                const selectedDate = parseDate(value);
                if (selectedDate && !isNaN(selectedDate.getTime())) {
                    setCurrentMonth(
                        new Date(
                            selectedDate.getFullYear(),
                            selectedDate.getMonth(),
                            1
                        )
                    );
                }
            } else {
                setCurrentMonth(
                    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                );
            }
        }
        setIsOpen(!isOpen);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            menuRef.current &&
            !menuRef.current.contains(event.target as Node)
        ) {
            setIsOpen(false);
        }
    };

    const handleDateSelect = (date: Date) => {
        try {
            onChange(formatDate(date));
            setIsOpen(false);
        } catch (error) {
            console.error('Error in date selection:', error);
            setIsOpen(false);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth((prev) => {
            const newMonth = new Date(prev);
            if (direction === 'prev') {
                newMonth.setMonth(newMonth.getMonth() - 1);
            } else {
                newMonth.setMonth(newMonth.getMonth() + 1);
            }
            return newMonth;
        });
    };

    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Adjust starting day based on first day of week setting
        const adjustedStartingDay =
            (startingDayOfWeek - firstDayOfWeek + 7) % 7;

        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < adjustedStartingDay; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        return days;
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        if (!value) return false;
        const selectedDate = parseDate(value);
        return (
            selectedDate && date.toDateString() === selectedDate.toDateString()
        );
    };

    // Load first day of week setting on mount
    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                const firstDay = await getFirstDayOfWeek();
                setFirstDayOfWeek(firstDay);
            } catch {
                // Fallback to locale-based default
                const fallbackFirstDay = getLocaleFirstDayOfWeek(
                    navigator.language
                );
                setFirstDayOfWeek(fallbackFirstDay);
            }
        };
        loadFirstDayOfWeek();
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div
            ref={dropdownRef}
            data-testid="datepicker"
            data-state={isOpen ? 'open' : 'closed'}
            className={`relative inline-block text-left w-full ${className}`}
        >
            <div className="relative">
                <button
                    type="button"
                    className={`inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggle();
                    }}
                    disabled={disabled}
                >
                    <span
                        className={`truncate ${!value ? 'text-gray-500 dark:text-gray-400' : ''}`}
                    >
                        {formatDisplayDate(value)}
                    </span>
                    <div className="flex items-center space-x-1">
                        <CalendarDaysIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                    </div>
                </button>
                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs w-4 h-4 flex items-center justify-center"
                    >
                        ×
                    </button>
                )}
            </div>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 date-picker-menu"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
                            <button
                                type="button"
                                onClick={() => navigateMonth('prev')}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            >
                                <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {months[currentMonth.getMonth()]}{' '}
                                {currentMonth.getFullYear()}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigateMonth('next')}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            >
                                <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="p-3">
                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {getDaysOfWeek().map((day) => (
                                    <div
                                        key={day}
                                        className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7 gap-1">
                                {getDaysInMonth().map((date, index) => (
                                    <div key={index} className="aspect-square">
                                        {date && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDateSelect(date)
                                                }
                                                className={`w-full h-full text-xs rounded transition-colors ${
                                                    isSelected(date)
                                                        ? 'bg-blue-600 text-white'
                                                        : isToday(date)
                                                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                                          : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                                                }`}
                                            >
                                                {date.getDate()}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 dark:border-gray-600 p-3 flex justify-between">
                            <button
                                type="button"
                                onClick={() => handleDateSelect(new Date())}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                                Today
                            </button>
                            {value && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default DatePicker;
