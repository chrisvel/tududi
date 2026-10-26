const pad = (n: number) => String(n).padStart(2, '0');

// Splits the ISO value from DateTimePicker into the API's due_date and
// due_time. Midnight means "no time": the picker always carries a time, but
// a whole-day due date must not turn into a timed one.
export const toDueParts = (
    iso: string
): { date: string | null; time: string | null } => {
    if (!iso) return { date: null, time: null };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: null, time: null };
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date, time: time === '00:00' ? null : time };
};

// Builds the ISO value DateTimePicker expects from the API's due_date and due_time.
export const fromDueParts = (
    date: string | null | undefined,
    time: string | null | undefined
): string => {
    if (!date) return '';
    const [y, m, d] = date.split('T')[0].split('-').map(Number);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm).toISOString();
};

// True when a start (date + optional time) falls after the due date. A
// whole-day due date lasts until the end of that day.
export const isStartAfterDue = (
    startDate: string | null | undefined,
    startTime: string | null | undefined,
    dueDate: string | null | undefined,
    dueTime: string | null | undefined
): boolean => {
    if (!startDate || !dueDate) return false;
    const start = `${startDate.split('T')[0]} ${startTime || '00:00'}`;
    const due = `${dueDate.split('T')[0]} ${dueTime || '23:59'}`;
    return start > due;
};
