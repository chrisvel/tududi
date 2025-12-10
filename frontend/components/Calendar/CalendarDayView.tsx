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
    onEventDrop?: (eventId: string, newDate: Date, newHour: number) => void;
}

const CalendarDayView: React.FC<CalendarDayViewProps> = ({
    currentDate,
    events,
    onEventClick,
    onTimeSlotClick,
    onEventDrop,
}) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const [draggedEventId, setDraggedEventId] = React.useState<string | null>(
        null
    );

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

    const handleDrop = (hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onEventDrop) {
            onEventDrop(eventId, currentDate, hour);
        }
        setDraggedEventId(null);
    };

    return (
        <div className="h-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="p-6 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750">
                <div className="text-center">
                    <div
                        className={`text-sm font-semibold uppercase tracking-wider mb-2 ${
                            isToday(currentDate)
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {format(currentDate, 'EEEE')}
                    </div>
                    <div
                        className={`text-4xl font-bold mb-1 ${
                            isToday(currentDate)
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {isToday(currentDate) ? (
                            <span className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-lg">
                                {format(currentDate, 'd')}
                            </span>
                        ) : (
                            format(currentDate, 'd')
                        )}
                    </div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {format(currentDate, 'MMMM yyyy')}
                    </div>
                </div>
            </div>

            {/* All day events */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                    All day
                </div>
                <div className="space-y-2">
                    {events
                        .filter((event) => {
                            const eventDay = format(event.start, 'yyyy-MM-dd');
                            const currentDay = format(
                                currentDate,
                                'yyyy-MM-dd'
                            );
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
                                className={`text-sm px-3 py-2 rounded-lg text-white cursor-pointer hover:scale-[1.01] hover:shadow-md transition-all duration-200 font-medium ${
                                    event.type === 'task'
                                        ? 'border-l-3 border-l-white/60'
                                        : ''
                                }`}
                                style={{
                                    backgroundColor: event.color || '#3b82f6',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                                title={event.title}
                            >
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
                            className="relative border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex">
                                {/* Time column */}
                                <div className="w-20 py-3 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center border-r-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
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
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(hour, e)}
                                    className="flex-1 min-h-[60px] cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10 relative transition-colors duration-150 bg-white dark:bg-gray-900"
                                >
                                    {timeSlotEvents.map((event, index) => {
                                        const eventCount =
                                            timeSlotEvents.length;
                                        const widthPercentage =
                                            eventCount > 1
                                                ? 100 / eventCount - 2
                                                : 100;
                                        const leftOffset =
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
                                                className={`absolute text-sm px-3 py-2 rounded-lg text-white transition-all duration-200 z-10 font-medium ${
                                                    event.type === 'task'
                                                        ? 'border-l-3 border-l-white/60 cursor-move hover:scale-[1.01] hover:shadow-lg'
                                                        : 'cursor-pointer'
                                                } ${draggedEventId === event.id ? 'opacity-50' : ''}`}
                                                style={{
                                                    backgroundColor:
                                                        event.color ||
                                                        '#3b82f6',
                                                    top: calculateEventPosition(
                                                        event
                                                    ),
                                                    height: calculateEventHeight(
                                                        event
                                                    ),
                                                    left: `calc(0.5rem + ${leftOffset}%)`,
                                                    width: `${widthPercentage}%`,
                                                    boxShadow:
                                                        '0 3px 6px rgba(0,0,0,0.15)',
                                                }}
                                                title={`${event.title} - ${format(event.start, 'HH:mm')} to ${format(event.end, 'HH:mm')}`}
                                            >
                                                <div className="font-semibold">
                                                    {event.title}
                                                </div>
                                                <div className="text-xs opacity-90 mt-1">
                                                    {format(
                                                        event.start,
                                                        'HH:mm'
                                                    )}{' '}
                                                    -{' '}
                                                    {format(event.end, 'HH:mm')}
                                                </div>
                                            </div>
                                        );
                                    })}
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
