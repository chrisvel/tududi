import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';

interface DateTimePickerProps {
    value: string; // ISO string
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select date and time',
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
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState('12:00');
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(0);
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

    // Generate time options in 15-minute increments
    const generateTimeOptions = () => {
        const options = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const h = String(hour).padStart(2, '0');
                const m = String(minute).padStart(2, '0');
                options.push(`${h}:${m}`);
            }
        }
        return options;
    };

    const timeOptions = generateTimeOptions();

    const getAllDays = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const getDaysOfWeek = () => {
        const allDays = getAllDays();
        return [
            ...allDays.slice(firstDayOfWeek),
            ...allDays.slice(0, firstDayOfWeek),
        ];
    };

    const parseDateTime = (
        isoString: string
    ): { date: Date | null; time: string } => {
        if (!isoString) return { date: null, time: '12:00' };
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return { date: null, time: '12:00' };

            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(
                Math.floor(date.getMinutes() / 15) * 15
            ).padStart(2, '0');
            return { date, time: `${hours}:${minutes}` };
        } catch {
            return { date: null, time: '12:00' };
        }
    };

    const formatDisplayDateTime = (isoString: string) => {
        if (!isoString) return placeholder;
        const { date, time } = parseDateTime(isoString);
        if (!date) return placeholder;

        const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

        // Convert 24h to 12h format for display
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

        return `${dateStr} at ${displayHour}:${minutes} ${ampm}`;
    };

    useEffect(() => {
        const { date, time } = parseDateTime(value);
        if (date) {
            setSelectedDate(date);
            setSelectedTime(time);
            setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
    }, [value]);

    const handleToggle = () => {
        if (disabled) return;

        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = 420; // Calendar + time picker height
            const padding = 16;

            const wouldFitBelow = spaceBelow >= menuHeight + padding;
            const wouldFitAbove = spaceAbove >= menuHeight + padding;

            let openUpward = false;
            let top = rect.bottom + 8;

            if (!wouldFitBelow && wouldFitAbove) {
                openUpward = true;
                top = rect.top - menuHeight - 8;
            } else if (!wouldFitBelow && !wouldFitAbove) {
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

            const calendarWidth = Math.min(Math.max(rect.width, 280), 320);
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
        setSelectedDate(date);
    };

    const handleApply = () => {
        if (!selectedDate) return;

        const [hours, minutes] = selectedTime.split(':');
        const dateTime = new Date(selectedDate);
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        onChange(dateTime.toISOString());
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSelectedDate(null);
        setSelectedTime('12:00');
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

        const adjustedStartingDay =
            (startingDayOfWeek - firstDayOfWeek + 7) % 7;

        const days = [];

        for (let i = 0; i < adjustedStartingDay; i++) {
            days.push(null);
        }

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
        return (
            selectedDate && date.toDateString() === selectedDate.toDateString()
        );
    };

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                const firstDay = await getFirstDayOfWeek();
                setFirstDayOfWeek(firstDay);
            } catch {
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
            data-testid="datetimepicker"
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
                        {formatDisplayDateTime(value)}
                    </span>
                    <div className="flex items-center space-x-1">
                        <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
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
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600"
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

                        {/* Time Picker */}
                        <div className="border-t border-gray-200 dark:border-gray-600 p-3">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">
                                Time
                            </label>
                            <select
                                value={selectedTime}
                                onChange={(e) =>
                                    setSelectedTime(e.target.value)
                                }
                                className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
                            >
                                {timeOptions.map((time) => {
                                    const [h, m] = time.split(':');
                                    const hour = parseInt(h);
                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                    const displayHour =
                                        hour === 0
                                            ? 12
                                            : hour > 12
                                              ? hour - 12
                                              : hour;
                                    return (
                                        <option key={time} value={time}>
                                            {displayHour}:{m} {ampm}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 dark:border-gray-600 p-3 flex justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    setSelectedDate(now);
                                    const hours = String(
                                        now.getHours()
                                    ).padStart(2, '0');
                                    const minutes = String(
                                        Math.floor(now.getMinutes() / 15) * 15
                                    ).padStart(2, '0');
                                    setSelectedTime(`${hours}:${minutes}`);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                                Now
                            </button>
                            <div className="flex space-x-2">
                                {value && (
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={!selectedDate}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default DateTimePicker;
