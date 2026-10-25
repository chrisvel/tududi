import { DateShortcut, shortcutDate } from '../dateShortcuts';

const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 2026-10-26 is a Monday.
const week = [
    ['Mon', new Date(2026, 9, 26, 15, 30)],
    ['Tue', new Date(2026, 9, 27, 9, 0)],
    ['Wed', new Date(2026, 9, 28, 9, 0)],
    ['Thu', new Date(2026, 9, 29, 9, 0)],
    ['Fri', new Date(2026, 9, 30, 23, 45)],
    ['Sat', new Date(2026, 9, 31, 9, 0)],
    ['Sun', new Date(2026, 10, 1, 0, 5)],
] as const;

describe('shortcutDate', () => {
    it.each([
        // day, today, tomorrow, weekend, next week (Mon start), next week (Sun start)
        [
            'Mon',
            '2026-10-26',
            '2026-10-27',
            '2026-10-31',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Tue',
            '2026-10-27',
            '2026-10-28',
            '2026-10-31',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Wed',
            '2026-10-28',
            '2026-10-29',
            '2026-10-31',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Thu',
            '2026-10-29',
            '2026-10-30',
            '2026-10-31',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Fri',
            '2026-10-30',
            '2026-10-31',
            '2026-10-31',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Sat',
            '2026-10-31',
            '2026-11-01',
            '2026-11-07',
            '2026-11-02',
            '2026-11-01',
        ],
        [
            'Sun',
            '2026-11-01',
            '2026-11-02',
            '2026-11-07',
            '2026-11-02',
            '2026-11-08',
        ],
    ])(
        '%s resolves every shortcut',
        (day, today, tomorrow, weekend, nextMon, nextSun) => {
            const now = week.find(([name]) => name === day)![1];
            const at = (kind: DateShortcut, first = 1) =>
                ymd(shortcutDate(kind, now, first));
            expect(at('today')).toBe(today);
            expect(at('tomorrow')).toBe(tomorrow);
            expect(at('weekend')).toBe(weekend);
            expect(at('next_week', 1)).toBe(nextMon);
            expect(at('next_week', 0)).toBe(nextSun);
        }
    );

    it('returns local midnight', () => {
        const d = shortcutDate('tomorrow', new Date(2026, 9, 24, 18, 20));
        expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    });

    it('rolls over the year', () => {
        const now = new Date(2026, 11, 31, 10, 0); // Thursday
        expect(ymd(shortcutDate('tomorrow', now))).toBe('2027-01-01');
        expect(ymd(shortcutDate('weekend', now))).toBe('2027-01-02');
        expect(ymd(shortcutDate('next_week', now, 1))).toBe('2027-01-04');
    });
});
