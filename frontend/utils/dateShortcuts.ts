export type DateShortcut = 'today' | 'tomorrow' | 'weekend' | 'next_week';

export const DATE_SHORTCUTS: DateShortcut[] = [
    'today',
    'tomorrow',
    'weekend',
    'next_week',
];

const SATURDAY = 6;

// Resolves a shortcut to a local-midnight date. Weekend is the coming
// Saturday; on a Saturday or Sunday it is next week's. Next week is the
// first day of the following week, per the user's first-day-of-week setting.
export const shortcutDate = (
    kind: DateShortcut,
    now: Date,
    firstDayOfWeek = 0
): Date => {
    const day = now.getDay();
    let offset = 0;
    if (kind === 'tomorrow') {
        offset = 1;
    } else if (kind === 'weekend') {
        offset = (SATURDAY - day + 7) % 7 || 7;
    } else if (kind === 'next_week') {
        offset = (firstDayOfWeek - day + 7) % 7 || 7;
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
};
