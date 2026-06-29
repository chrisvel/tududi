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
    const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null);

    const getEventsForTimeSlot = (hour: number) =>
        events.filter(
            (event) =>
                format(event.start, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd') &&
                event.start.getHours() === hour
        );

    const calculateEventHeight = (event: CalendarEvent) => {
        const durationHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
        return Math.max(durationHours * 48, 24);
    };

    const calculateEventPosition = (event: CalendarEvent) =>
        (event.start.getMinutes() / 60) * 48;

    const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedEventId(event.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', event.id);
    };

    const handleDragEnd = () => setDraggedEventId(null);

    const handleDrop = (hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onEventDrop) onEventDrop(eventId, currentDate, hour);
        setDraggedEventId(null);
    };

    const todayClass = isToday(currentDate);

    return (
        <div className="h-full bg-white dark:bg-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-600">
            {/* Day header */}
            <div className={`p-5 border-b border-gray-200 dark:border-gray-600 text-center ${todayClass ? 'bg-blue-50 dark:bg-blue-900/15' : 'bg-gray-50 dark:bg-gray-800'}`}>
                <div
                    className={`text-xs font-semibold tracking-widest uppercase mb-2 ${
                        todayClass ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                    }`}
                >
                    {format(currentDate, 'EEEE')}
                </div>
                <div>
                    {todayClass ? (
                        <span className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 text-white text-xl font-semibold rounded-full">
                            {format(currentDate, 'd')}
                        </span>
                    ) : (
                        <span className="text-4xl font-light text-gray-700 dark:text-gray-300">
                            {format(currentDate, 'd')}
                        </span>
                    )}
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    {format(currentDate, 'MMMM yyyy')}
                </div>
            </div>

            {/* All-day events */}
            {events.filter((event) => {
                const eventDay = format(event.start, 'yyyy-MM-dd');
                const currentDay = format(currentDate, 'yyyy-MM-dd');
                const duration = event.end.getTime() - event.start.getTime();
                return eventDay === currentDay && duration >= 24 * 60 * 60 * 1000;
            }).length > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                    <div className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2">
                        All day
                    </div>
                    <div className="space-y-1">
                        {events
                            .filter((event) => {
                                const eventDay = format(event.start, 'yyyy-MM-dd');
                                const currentDay = format(currentDate, 'yyyy-MM-dd');
                                const duration = event.end.getTime() - event.start.getTime();
                                return eventDay === currentDay && duration >= 24 * 60 * 60 * 1000;
                            })
                            .map((event) => (
                                <div
                                    key={event.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventClick?.(event);
                                    }}
                                    className="text-xs px-2.5 py-1.5 rounded-lg text-white cursor-pointer hover:opacity-90 transition-opacity font-medium"
                                    style={{ backgroundColor: event.color || '#3b82f6' }}
                                    title={event.title}
                                >
                                    {event.title}
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Time slots */}
            <div className="flex-1 overflow-y-auto">
                {hours.map((hour) => {
                    const timeSlotEvents = getEventsForTimeSlot(hour);

                    return (
                        <div
                            key={hour}
                            className="relative border-b border-gray-100 dark:border-gray-600"
                        >
                            <div className="flex">
                                <div className="w-20 py-3 px-2 text-xs font-medium text-gray-400 dark:text-gray-500 text-center border-r border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 shrink-0">
                                    {format(addHours(new Date().setHours(hour, 0, 0, 0), 0), 'HH:mm')}
                                </div>
                                <div
                                    onClick={() => onTimeSlotClick?.(currentDate, hour)}
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                    onDrop={(e) => handleDrop(hour, e)}
                                    className="flex-1 min-h-[56px] cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/10 relative transition-colors"
                                >
                                    {timeSlotEvents.map((event, index) => {
                                        const eventCount = timeSlotEvents.length;
                                        return (
                                            <div
                                                key={event.id}
                                                draggable={event.type === 'task'}
                                                onDragStart={(e) => handleDragStart(event, e)}
                                                onDragEnd={handleDragEnd}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEventClick?.(event);
                                                }}
                                                className={`absolute text-xs px-2.5 py-1.5 rounded-lg text-white z-10 font-medium overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                                                    event.type === 'task' ? 'cursor-move' : ''
                                                } ${draggedEventId === event.id ? 'opacity-40' : ''}`}
                                                style={{
                                                    backgroundColor: event.color || '#3b82f6',
                                                    top: calculateEventPosition(event),
                                                    height: calculateEventHeight(event),
                                                    left: `calc(0.5rem + ${(100 / eventCount) * index}%)`,
                                                    width: `${eventCount > 1 ? 100 / eventCount - 2 : 100}%`,
                                                }}
                                                title={`${event.title} - ${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`}
                                            >
                                                <div className="font-semibold truncate">{event.title}</div>
                                                <div className="text-[10px] opacity-75 mt-0.5">
                                                    {format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}
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
