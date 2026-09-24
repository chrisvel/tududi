import React from 'react';
import { tint } from './planUtils';

interface CalendarBadgeProps {
    name: string;
    color: string | null;
}

// Which calendar an event comes from, in that calendar's colour. The row
// itself stays neutral; only this small pill carries the colour.
const CalendarBadge: React.FC<CalendarBadgeProps> = ({ name, color }) => (
    <span
        className={`inline-flex max-w-[40%] shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200 ${
            color ? '' : 'bg-gray-200/70 dark:bg-gray-700/60'
        }`}
        style={color ? { backgroundColor: tint(color, 0.18) } : undefined}
        data-testid="calendar-badge"
    >
        <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400"
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden="true"
        />
        <span className="truncate">{name}</span>
    </span>
);

export default CalendarBadge;
