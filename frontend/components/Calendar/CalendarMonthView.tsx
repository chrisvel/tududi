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
    onEventDrop?: (eventId: string, newDate: Date) => void;
}

const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
    currentDate,
    events,
    onDateClick,
    onEventClick,
    onEventDrop,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1); // Default to Monday
    const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

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

    const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedEventId(event.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', event.id);
    };

    const handleDragEnd = () => {
        setDraggedEventId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (day: Date, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onEventDrop) {
            onEventDrop(eventId, day);
        }
        setDraggedEventId(null);
    };

    return (
        <div className="h-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750">
                {weekDays.map((day) => (
                    <div
                        key={day}
                        className="py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr divide-x divide-gray-200 dark:divide-gray-700">
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
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(day, e)}
                            className={`p-2.5 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 flex flex-col min-h-[100px] ${
                                !isCurrentMonth
                                    ? 'bg-gray-100/50 dark:bg-gray-800/30'
                                    : 'bg-white dark:bg-gray-900 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                            } ${isTodayDate ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-500' : ''}`}
                        >
                            <div className="flex items-start justify-between mb-1.5">
                                {isTodayDate ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-bold rounded-full shadow-md">
                                        {format(day, 'd')}
                                    </span>
                                ) : (
                                    <span
                                        className={`text-sm font-medium ${
                                            !isCurrentMonth
                                                ? 'text-gray-400 dark:text-gray-600'
                                                : 'text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {format(day, 'd')}
                                    </span>
                                )}
                            </div>

                            {/* Events */}
                            <div className="space-y-1 overflow-hidden flex-1">
                                {dayEvents.slice(0, 3).map((event) => (
                                    <div
                                        key={event.id}
                                        draggable={event.type === 'task'}
                                        onDragStart={(e) =>
                                            handleDragStart(event, e)
                                        }
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) =>
                                            handleEventClick(event, e)
                                        }
                                        className={`text-xs px-2 py-1.5 rounded-md text-white truncate transition-all duration-200 font-medium ${
                                            event.type === 'task'
                                                ? 'border-l-3 border-l-white/60 cursor-move hover:scale-[1.02] hover:shadow-md'
                                                : 'cursor-pointer'
                                        } ${draggedEventId === event.id ? 'opacity-50' : ''}`}
                                        style={{
                                            backgroundColor:
                                                event.color || '#3b82f6',
                                            boxShadow:
                                                '0 1px 3px rgba(0,0,0,0.1)',
                                        }}
                                        title={event.title}
                                    >
                                        <span className="truncate">
                                            {event.title}
                                        </span>
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 px-1.5 py-0.5 font-medium bg-gray-100 dark:bg-gray-800 rounded-md inline-block">
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
