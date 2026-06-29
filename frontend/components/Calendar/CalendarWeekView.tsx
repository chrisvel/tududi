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
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1);
    const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                setFirstDayOfWeek(await getFirstDayOfWeek());
            } catch {
                setFirstDayOfWeek(getLocaleFirstDayOfWeek(navigator.language));
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

    const getEventsForTimeSlot = (day: Date, hour: number) =>
        events.filter(
            (event) =>
                format(event.start, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
                event.start.getHours() === hour
        );

    const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedEventId(event.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', event.id);
    };

    const handleDragEnd = () => setDraggedEventId(null);

    const handleDrop = (day: Date, hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onEventDrop) onEventDrop(eventId, day, hour);
        setDraggedEventId(null);
    };

    return (
        <div className="h-full bg-white dark:bg-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-600">
            {/* Day headers */}
            <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                <div className="p-3 text-center text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-600">
                    {/* time col */}
                </div>
                {weekDays.map((day) => (
                    <div
                        key={day.toString()}
                        className={`p-3 text-center border-l border-gray-200 dark:border-gray-600 ${
                            isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                    >
                        <div
                            className={`text-xs font-semibold tracking-widest uppercase mb-1 ${
                                isToday(day)
                                    ? 'text-blue-500 dark:text-blue-400'
                                    : 'text-gray-400 dark:text-gray-500'
                            }`}
                        >
                            {format(day, 'EEE')}
                        </div>
                        <div>
                            {isToday(day) ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-500 text-white text-sm font-semibold rounded-full">
                                    {format(day, 'd')}
                                </span>
                            ) : (
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {format(day, 'd')}
                                </span>
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
                        className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-600"
                    >
                        <div className="py-3 px-2 text-xs font-medium text-gray-400 dark:text-gray-500 text-center border-r border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                            {format(addHours(new Date().setHours(hour, 0, 0, 0), 0), 'HH:mm')}
                        </div>
                        {weekDays.map((day) => {
                            const timeSlotEvents = getEventsForTimeSlot(day, hour);
                            const eventCount = timeSlotEvents.length;

                            return (
                                <div
                                    key={`${day.toString()}-${hour}`}
                                    onClick={() => onTimeSlotClick?.(day, hour)}
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                    onDrop={(e) => handleDrop(day, hour, e)}
                                    className={`min-h-[72px] p-1.5 border-l border-gray-100 dark:border-gray-600 cursor-pointer transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 relative ${
                                        isToday(day) ? 'bg-blue-50/10 dark:bg-blue-900/5' : ''
                                    }`}
                                >
                                    {timeSlotEvents.map((event, index) => (
                                        <div
                                            key={event.id}
                                            draggable={event.type === 'task'}
                                            onDragStart={(e) => handleDragStart(event, e)}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEventClick?.(event);
                                            }}
                                            className={`text-xs px-2 py-1.5 rounded-lg text-white absolute font-medium overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                                                event.type === 'task' ? 'cursor-move' : ''
                                            } ${draggedEventId === event.id ? 'opacity-40' : ''}`}
                                            style={{
                                                backgroundColor: event.color || '#3b82f6',
                                                left: `${(100 / eventCount) * index}%`,
                                                width: `${eventCount > 1 ? 100 / eventCount - 1 : 100}%`,
                                                top: '0.25rem',
                                                bottom: '0.25rem',
                                            }}
                                            title={event.title}
                                        >
                                            <div className="line-clamp-2 leading-tight">
                                                {event.title}
                                            </div>
                                            <div className="text-[10px] opacity-75 mt-0.5">
                                                {format(event.start, 'HH:mm')}
                                            </div>
                                        </div>
                                    ))}
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
