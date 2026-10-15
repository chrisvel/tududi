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
