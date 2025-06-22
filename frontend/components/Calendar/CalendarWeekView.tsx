import React from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addHours } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'task' | 'event' | 'google';
  color?: string;
}

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date, hour: number) => void;
}

const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ 
  currentDate, 
  events, 
  onDateClick, 
  onEventClick,
  onTimeSlotClick 
}) => {
  const { t } = useTranslation();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForTimeSlot = (day: Date, hour: number) => {
    return events.filter(event => {
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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          Time
        </div>
        {weekDays.map(day => (
          <div key={day.toString()} className={`p-3 text-center border-l border-gray-200 dark:border-gray-700 ${
            isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}>
            <div className={`text-sm font-medium ${
              isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
            }`}>
              {format(day, 'EEE')}
            </div>
            <div className={`text-lg ${
              isToday(day) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isToday(day) ? (
                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white text-sm font-bold rounded-full">
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
      <div className="max-h-96 overflow-y-auto">
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-800">
            {/* Time column */}
            <div className="p-2 text-xs text-gray-500 dark:text-gray-400 text-center border-r border-gray-200 dark:border-gray-700">
              {format(addHours(new Date().setHours(hour, 0, 0, 0), 0), 'HH:mm')}
            </div>
            
            {/* Day columns */}
            {weekDays.map(day => {
              const timeSlotEvents = getEventsForTimeSlot(day, hour);
              
              return (
                <div
                  key={`${day.toString()}-${hour}`}
                  onClick={() => handleTimeSlotClick(day, hour)}
                  className={`h-12 p-1 border-l border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 relative ${
                    isToday(day) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {timeSlotEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => handleEventClick(event, e)}
                      className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity absolute inset-1 ${
                        event.type === 'task' ? 'border-l-2 border-l-white/50' : ''
                      }`}
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                      title={`${event.type === 'task' ? '📋 ' : ''}${event.title} - ${format(event.start, 'HH:mm')} to ${format(event.end, 'HH:mm')}`}
                    >
                      {event.type === 'task' && '📋 '}{event.title}
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