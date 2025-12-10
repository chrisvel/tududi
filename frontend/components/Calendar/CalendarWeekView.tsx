import React, { useState, useEffect } from 'react';
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isToday,
    addHours,
} from 'date-fns';
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

interface CalendarWeekViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: CalendarEvent) => void;
    onTimeSlotClick?: (date: Date, hour: number) => void;
    onEventDrop?: (eventId: string, newDate: Date, newHour: number) => void;
}

const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
    currentDate,
    events,
    onEventClick,
    onTimeSlotClick,
    onEventDrop,
}) => {
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

    const weekStart = startOfWeek(currentDate, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const weekEnd = endOfWeek(currentDate, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getEventsForTimeSlot = (day: Date, hour: number) => {
        return events.filter((event) => {
            const eventDay = format(event.start, 'yyyy-MM-dd');
            const slotDay = format(day, 'yyyy-MM-dd');
            const eventHour = event.start.getHours();

            return eventDay === slotDay && eventHour === hour;
        });
    };

    const handleTimeSlotClick = (day: Date, hour: number) => {
        if (onTimeSlotClick) {
            onTimeSlotClick(day, hour);
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

    const handleDrop = (day: Date, hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onEventDrop) {
            onEventDrop(eventId, day, hour);
        }
        setDraggedEventId(null);
    };

    return (
        <div className="h-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            {/* Header with days */}
            <div className="grid grid-cols-8 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 sticky top-0 z-10">
                <div className="p-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    Time
                </div>
                {weekDays.map((day) => (
                    <div
                        key={day.toString()}
                        className={`p-3 text-center border-l border-gray-200 dark:border-gray-700 transition-colors ${
                            isToday(day)
                                ? 'bg-gradient-to-b from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20'
                                : ''
                        }`}
                    >
                        <div
                            className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                                isToday(day)
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {format(day, 'EEE')}
                        </div>
                        <div
                            className={`text-lg ${
                                isToday(day)
                                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            {isToday(day) ? (
                                <span className="inline-flex items-center justify-center w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-bold rounded-full shadow-md">
                                    {format(day, 'd')}
                                </span>
                            ) : (
                                format(day, 'd')
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Time slots */}
            <div className="flex-1 overflow-y-auto">
                {hours.map((hour) => (
                    <div
                        key={hour}
                        className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700"
                    >
                        {/* Time column */}
                        <div className="py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center border-r-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            {format(
                                addHours(new Date().setHours(hour, 0, 0, 0), 0),
                                'HH:mm'
                            )}
                        </div>

                        {/* Day columns */}
                        {weekDays.map((day) => {
                            const timeSlotEvents = getEventsForTimeSlot(
                                day,
                                hour
                            );
                            const eventCount = timeSlotEvents.length;

                            return (
                                <div
                                    key={`${day.toString()}-${hour}`}
                                    onClick={() =>
                                        handleTimeSlotClick(day, hour)
                                    }
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(day, hour, e)}
                                    className={`min-h-[80px] p-2 border-l border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-150 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 relative ${
                                        isToday(day)
                                            ? 'bg-blue-50/20 dark:bg-blue-900/5'
                                            : 'bg-white dark:bg-gray-900'
                                    }`}
                                >
                                    {timeSlotEvents.map((event, index) => {
                                        const widthPercentage =
                                            eventCount > 1
                                                ? 100 / eventCount - 1
                                                : 100;
                                        const leftPercentage =
                                            eventCount > 1
                                                ? (100 / eventCount) * index
                                                : 0;

                                        return (
                                            <div
                                                key={event.id}
                                                draggable={
                                                    event.type === 'task'
                                                }
                                                onDragStart={(e) =>
                                                    handleDragStart(event, e)
                                                }
                                                onDragEnd={handleDragEnd}
                                                onClick={(e) =>
                                                    handleEventClick(event, e)
                                                }
                                                className={`text-sm px-2 py-2 rounded-lg text-white transition-all duration-200 absolute font-medium overflow-hidden ${
                                                    event.type === 'task'
                                                        ? 'border-l-3 border-l-white/60 cursor-move hover:scale-[1.02] hover:shadow-lg'
                                                        : 'cursor-pointer'
                                                } ${draggedEventId === event.id ? 'opacity-50' : ''}`}
                                                style={{
                                                    backgroundColor:
                                                        event.color ||
                                                        '#3b82f6',
                                                    boxShadow:
                                                        '0 2px 4px rgba(0,0,0,0.15)',
                                                    left: `${leftPercentage}%`,
                                                    width: `${widthPercentage}%`,
                                                    top: '0.5rem',
                                                    bottom: '0.5rem',
                                                }}
                                                title={`${event.title} - ${format(event.start, 'HH:mm')} to ${format(event.end, 'HH:mm')}`}
                                            >
                                                <div className="flex flex-col gap-0.5 h-full">
                                                    <div className="line-clamp-2 leading-tight font-semibold text-xs">
                                                        {event.title}
                                                    </div>
                                                    <div className="text-xs opacity-80 mt-auto">
                                                        {format(
                                                            event.start,
                                                            'HH:mm'
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CalendarWeekView;
