const {
    parseCalendar,
    eventsForDate,
    eventsForRange,
} = require('../../../modules/calendar-feeds/icsEvents');
const axios = require('axios');
const dns = require('dns');
const {
    fetchFeed,
    normalizeFeedUrl,
    FeedFetchError,
} = require('../../../modules/calendar-feeds/fetcher');

const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    // Weekdays at 08:00 Athens time, skipped on the 25th, moved on the 24th.
    'BEGIN:VEVENT',
    'UID:school',
    'DTSTART;TZID=Europe/Athens:20260901T080000',
    'DTEND;TZID=Europe/Athens:20260901T083000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    'EXDATE;TZID=Europe/Athens:20260925T080000',
    'SUMMARY:School drop-off',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:school',
    'RECURRENCE-ID;TZID=Europe/Athens:20260924T080000',
    'DTSTART;TZID=Europe/Athens:20260924T090000',
    'DTEND;TZID=Europe/Athens:20260924T093000',
    'SUMMARY:School drop-off (late start)',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:call',
    'DTSTART:20260924T090000Z',
    'DTEND:20260924T093000Z',
    'SUMMARY:Call with accountant',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:holiday',
    'DTSTART;VALUE=DATE:20260924',
    'DTEND;VALUE=DATE:20260925',
    'SUMMARY:Name day',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:late',
    'DTSTART;TZID=Europe/Athens:20260924T230000',
    'DTEND;TZID=Europe/Athens:20260925T010000',
    'SUMMARY:Late show',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:cancelled',
    'DTSTART;TZID=Europe/Athens:20260924T140000',
    'DTEND;TZID=Europe/Athens:20260924T150000',
    'STATUS:CANCELLED',
    'SUMMARY:Cancelled',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:free',
    'DTSTART;TZID=Europe/Athens:20260924T150000',
    'DTEND;TZID=Europe/Athens:20260924T153000',
    'TRANSP:TRANSPARENT',
    'SUMMARY:Maybe gym',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

describe('eventsForDate', () => {
    const events = parseCalendar(ICS);
    const titles = (date) =>
        eventsForDate(events, date, 'Europe/Athens').map((e) => e.title);

    it('uses the moved instance of a recurring event', () => {
        const day = eventsForDate(events, '2026-09-24', 'Europe/Athens');
        const school = day.find((e) => e.uid === 'school');
        expect(school.title).toBe('School drop-off (late start)');
        expect(school.start_minute).toBe(9 * 60);
    });

    it('skips an excluded date and keeps the others', () => {
        expect(titles('2026-09-25')).not.toContain('School drop-off');
        expect(titles('2026-09-23')).toContain('School drop-off');
        expect(titles('2026-09-26')).not.toContain('School drop-off');
    });

    it('converts UTC times into the user timezone', () => {
        const call = eventsForDate(events, '2026-09-24', 'Europe/Athens').find(
            (e) => e.uid === 'call'
        );
        expect(call.start_minute).toBe(12 * 60);
        expect(call.end_minute).toBe(12 * 60 + 30);
    });

    it('lists all-day events first without minutes', () => {
        const [first] = eventsForDate(events, '2026-09-24', 'Europe/Athens');
        expect(first).toMatchObject({
            title: 'Name day',
            all_day: true,
            start_minute: null,
        });
        expect(titles('2026-09-25')).not.toContain('Name day');
    });

    it('clips an event that crosses midnight to each day', () => {
        const before = eventsForDate(
            events,
            '2026-09-24',
            'Europe/Athens'
        ).find((e) => e.uid === 'late');
        const after = eventsForDate(events, '2026-09-25', 'Europe/Athens').find(
            (e) => e.uid === 'late'
        );
        expect([before.start_minute, before.end_minute]).toEqual([1380, 1440]);
        expect([after.start_minute, after.end_minute]).toEqual([0, 60]);
    });

    it('drops cancelled events and marks free ones as not busy', () => {
        const day = eventsForDate(events, '2026-09-24', 'Europe/Athens');
        expect(day.map((e) => e.title)).not.toContain('Cancelled');
        expect(day.find((e) => e.uid === 'free').busy).toBe(false);
        expect(day.find((e) => e.uid === 'call').busy).toBe(true);
    });
});

describe('eventsForRange', () => {
    const events = parseCalendar(ICS);
    const range = eventsForRange(
        events,
        '2026-09-23',
        '2026-09-26',
        'Europe/Athens'
    );
    const titlesOn = (date) =>
        range.filter((e) => e.date === date).map((e) => e.title);

    it('matches eventsForDate for every day in the range', () => {
        for (const date of [
            '2026-09-23',
            '2026-09-24',
            '2026-09-25',
            '2026-09-26',
        ]) {
            const single = eventsForDate(events, date, 'Europe/Athens');
            const fromRange = range
                .filter((e) => e.date === date)
                .map(({ date: _date, ...event }) => event);
            expect(fromRange).toEqual(single);
        }
    });

    it('tags each event with its day and keeps day order', () => {
        expect(titlesOn('2026-09-25')).not.toContain('School drop-off');
        expect(titlesOn('2026-09-24')).toContain('Name day');
        const dates = range.map((e) => e.date);
        expect(dates).toEqual([...dates].sort());
    });

    it('lists an event that crosses midnight on both days', () => {
        expect(titlesOn('2026-09-24')).toContain('Late show');
        expect(titlesOn('2026-09-25')).toContain('Late show');
    });
});

describe('normalizeFeedUrl', () => {
    it('turns webcal links into https', () => {
        expect(normalizeFeedUrl('webcal://example.com/a.ics')).toBe(
            'https://example.com/a.ics'
        );
    });

    it('rejects other schemes', () => {
        expect(() => normalizeFeedUrl('file:///etc/passwd')).toThrow();
        expect(() => normalizeFeedUrl('')).toThrow();
    });
});

describe('fetchFeed', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('refuses private and loopback addresses before connecting', async () => {
        const get = jest.spyOn(axios, 'get');
        await expect(fetchFeed('http://127.0.0.1/cal.ics')).rejects.toThrow(
            FeedFetchError
        );
        await expect(fetchFeed('http://10.0.0.5/cal.ics')).rejects.toThrow(
            FeedFetchError
        );
        expect(get).not.toHaveBeenCalled();
    });

    it('refuses a host that resolves to a private address at connect time', async () => {
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
        ]);
        jest.spyOn(dns, 'lookup').mockImplementation((host, opts, cb) =>
            cb(null, [{ address: '127.0.0.1', family: 4 }])
        );

        await expect(
            fetchFeed('http://rebind.example/cal.ics')
        ).rejects.toThrow(
            'That address points to a private or unsupported host'
        );
    });
});
