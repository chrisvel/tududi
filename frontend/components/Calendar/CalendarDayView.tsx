import React from 'react';
import { format, addHours, isToday } from 'date-fns';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'task' | 'event';
    color?: string;
}

interface CalendarDayViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onEventClick?: (event: CalendarEvent) => void;
    onTimeSlotClick?: (date: Date, hour: number) => void;
}

const CalendarDayView: React.FC<CalendarDayViewProps> = ({
    currentDate,
    events,
    onEventClick,
    onTimeSlotClick,
}) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getEventsForTimeSlot = (hour: number) => {
        return events.filter((event) => {
            const eventDay = format(event.start, 'yyyy-MM-dd');
            const currentDay = format(currentDate, 'yyyy-MM-dd');
            const eventHour = event.start.getHours();

            return eventDay === currentDay && eventHour === hour;
        });
    };

    const handleTimeSlotClick = (hour: number) => {
        if (onTimeSlotClick) {
            onTimeSlotClick(currentDate, hour);
        }
    };

    const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEventClick) {
            onEventClick(event);
        }
    };

    const calculateEventHeight = (event: CalendarEvent) => {
        const durationMs = event.end.getTime() - event.start.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        return Math.max(durationHours * 48, 24); // Minimum 24px height
    };

    const calculateEventPosition = (event: CalendarEvent) => {
        const minutes = event.start.getMinutes();
        return (minutes / 60) * 48; // 48px per hour
    };

    return (
        <div className="h-full bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="text-center">
                    <div
                        className={`text-lg font-medium ${
                            isToday(currentDate)
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-900 dark:text-gray-100'
                        }`}
                    >
                        {format(currentDate, 'EEEE')}
                    </div>
                    <div
                        className={`text-2xl font-bold ${
                            isToday(currentDate)
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {format(currentDate, 'd')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {format(currentDate, 'MMMM yyyy')}
                    </div>
                </div>
            </div>

            {/* All day events */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    All day
                </div>
                <div className="space-y-1">
                    {events
                        .filter((event) => {
                            const eventDay = format(event.start, 'yyyy-MM-dd');
                            const currentDay = format(
                                currentDate,
                                'yyyy-MM-dd'
                            );
                            // Check if it's an all-day event (spans 24 hours or more)
                            const duration =
                                event.end.getTime() - event.start.getTime();
                            return (
                                eventDay === currentDay &&
                                duration >= 24 * 60 * 60 * 1000
                            );
                        })
                        .map((event) => (
                            <div
                                key={event.id}
                                onClick={(e) => handleEventClick(event, e)}
                                className={`text-xs p-2 rounded text-white cursor-pointer hover:opacity-80 transition-opacity ${
                                    event.type === 'task'
                                        ? 'border-l-2 border-l-white/50'
                                        : ''
                                }`}
                                style={{
                                    backgroundColor: event.color || '#3b82f6',
                                }}
                                title={`${event.type === 'task' ? '📋 ' : ''}${event.title}`}
                            >
                                {event.type === 'task' && '📋 '}
                                {event.title}
                            </div>
                        ))}
                </div>
            </div>

            {/* Time slots */}
            <div className="flex-1 overflow-y-auto">
                {hours.map((hour) => {
                    const timeSlotEvents = getEventsForTimeSlot(hour);

                    return (
                        <div
                            key={hour}
                            className="relative border-b border-gray-100 dark:border-gray-800"
                        >
                            <div className="flex">
                                {/* Time column */}
                                <div className="w-16 p-2 text-xs text-gray-500 dark:text-gray-400 text-center border-r border-gray-200 dark:border-gray-700">
                                    {format(
                                        addHours(
                                            new Date().setHours(hour, 0, 0, 0),
                                            0
                                        ),
                                        'HH:mm'
                                    )}
                                </div>

                                {/* Event area */}
                                <div
                                    onClick={() => handleTimeSlotClick(hour)}
                                    className="flex-1 h-12 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 relative"
                                >
                                    {timeSlotEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={(e) =>
                                                handleEventClick(event, e)
                                            }
                                            className={`absolute left-1 right-1 text-xs p-1 rounded text-white cursor-pointer hover:opacity-80 transition-opacity z-10 ${
                                                event.type === 'task'
                                                    ? 'border-l-2 border-l-white/50'
                                                    : ''
                                            }`}
                                            style={{
                                                backgroundColor:
                                                    event.color || '#3b82f6',
                                                top: calculateEventPosition(
                                                    event
                                                ),
                                                height: calculateEventHeight(
                                                    event
                                                ),
                                            }}
                                            title={`${event.type === 'task' ? '📋 ' : ''}${event.title} - ${format(event.start, 'HH:mm')} to ${format(event.end, 'HH:mm')}`}
                                        >
                                            <div className="font-medium">
                                                {event.type === 'task' && '📋 '}
                                                {event.title}
                                            </div>
                                            <div className="text-xs opacity-90">
                                                {format(event.start, 'HH:mm')} -{' '}
                                                {format(event.end, 'HH:mm')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarDayView;
