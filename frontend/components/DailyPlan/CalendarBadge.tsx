import React from 'react';

interface CalendarBadgeProps {
    name: string;
    color: string | null;
}

// Which calendar an event comes from: a small dot in the calendar's colour
// and its name in quiet grey text. The row itself stays neutral.
const CalendarBadge: React.FC<CalendarBadgeProps> = ({ name, color }) => (
    <span
        className="inline-flex max-w-[40%] shrink-0 items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500"
        data-testid="calendar-badge"
    >
        <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 opacity-80"
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden="true"
        />
        <span className="truncate">{name}</span>
    </span>
);

export default CalendarBadge;
