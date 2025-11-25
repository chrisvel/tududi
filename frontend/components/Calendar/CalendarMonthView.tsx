import React, { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'task' | 'event';
    color?: string;
}

interface CalendarMonthViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: CalendarEvent) => void;
}

const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
    currentDate,
    events,
    onDateClick,
    onEventClick,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1); // Default to Monday

    // Load first day of week setting
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

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const calendarEnd = endOfWeek(monthEnd, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });

    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });

    // Generate weekdays array based on first day of week setting
    const getAllWeekDays = () => [
        t('weekdays.sunday', 'Sun'),
        t('weekdays.monday', 'Mon'),
        t('weekdays.tuesday', 'Tue'),
        t('weekdays.wednesday', 'Wed'),
        t('weekdays.thursday', 'Thu'),
        t('weekdays.friday', 'Fri'),
        t('weekdays.saturday', 'Sat'),
    ];

    const getWeekDays = () => {
        const allDays = getAllWeekDays();
        return [
            ...allDays.slice(firstDayOfWeek),
            ...allDays.slice(0, firstDayOfWeek),
        ];
    };

    const weekDays = getWeekDays();

    const handleDateClick = (date: Date) => {
        if (onDateClick) {
            onDateClick(date);
        }
    };

    const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEventClick) {
            onEventClick(event);
        }
    };

    return (
        <div className="h-full bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden flex flex-col">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {weekDays.map((day) => (
                    <div
                        key={day}
                        className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr">
                {days.map((day) => {
                    const dayEvents = events.filter(
                        (event) =>
                            format(event.start, 'yyyy-MM-dd') ===
                            format(day, 'yyyy-MM-dd')
                    );

                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => handleDateClick(day)}
                            className={`p-2 border-r border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex flex-col ${
                                !isCurrentMonth
                                    ? 'bg-gray-50 dark:bg-gray-800'
                                    : 'bg-white dark:bg-gray-900'
                            } ${isTodayDate ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300 dark:ring-blue-600' : ''}`}
                        >
                            <div
                                className={`text-sm mb-2 ${
                                    !isCurrentMonth
                                        ? 'text-gray-400 dark:text-gray-600'
                                        : 'text-gray-900 dark:text-gray-100'
                                } ${isTodayDate ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}
                            >
                                {isTodayDate && (
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                                        {format(day, 'd')}
                                    </span>
                                )}
                                {!isTodayDate && format(day, 'd')}
                            </div>

                            {/* Events */}
                            <div className="space-y-1">
                                {dayEvents.slice(0, 3).map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={(e) =>
                                            handleEventClick(event, e)
                                        }
                                        className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${
                                            event.type === 'task'
                                                ? 'border-l-2 border-l-white/50'
                                                : ''
                                        }`}
                                        style={{
                                            backgroundColor:
                                                event.color || '#3b82f6',
                                        }}
                                        title={`${event.type === 'task' ? '📋 ' : ''}${event.title}`}
                                    >
                                        {event.type === 'task' && '📋 '}
                                        {event.title}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                        +{dayEvents.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarMonthView;
