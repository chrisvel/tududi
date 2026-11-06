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

    it('places events by wall clock on a DST change day', () => {
        const dentist = parseCalendar(
            [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//test//EN',
                'BEGIN:VEVENT',
                'UID:dentist',
                'DTSTART;TZID=Europe/Athens:20261025T160000',
                'DTEND;TZID=Europe/Athens:20261025T170000',
                'SUMMARY:Dentist',
                'END:VEVENT',
                'END:VCALENDAR',
            ].join('\r\n')
        );
        const [event] = eventsForDate(dentist, '2026-10-25', 'Europe/Athens');
        expect(event.start_minute).toBe(16 * 60);
        expect(event.end_minute).toBe(17 * 60);
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

describe('eventsForRange on a long-lived feed', () => {
    const feed = (...events) =>
        parseCalendar(
            [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//test//EN',
                ...events.flatMap((lines) => [
                    'BEGIN:VEVENT',
                    ...lines,
                    'END:VEVENT',
                ]),
                'END:VCALENDAR',
            ].join('\r\n')
        );
    const series = (uid, ...lines) => [
        `UID:${uid}`,
        `SUMMARY:${uid}`,
        ...lines,
    ];
    const datesOf = (
        events,
        start = '2026-11-01',
        end = '2026-11-21',
        timezone = 'Europe/Athens'
    ) => eventsForRange(events, start, end, timezone).map((e) => e.date);

    it('keeps an every-other-week series on its own weeks', () => {
        const events = feed(
            series(
                'gym',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH'
            )
        );
        expect(datesOf(events)).toEqual([
            '2026-11-02',
            '2026-11-05',
            '2026-11-16',
            '2026-11-19',
        ]);
    });

    it('keeps a daily series with an interval on its own days', () => {
        const events = feed(
            series(
                'pills',
                'DTSTART;TZID=Europe/Athens:20100101T070000',
                'DTEND;TZID=Europe/Athens:20100101T071000',
                'RRULE:FREQ=DAILY;INTERVAL=3'
            )
        );
        expect(datesOf(events, '2026-11-01', '2026-11-10')).toEqual([
            '2026-11-03',
            '2026-11-06',
            '2026-11-09',
        ]);
    });

    it('still applies an EXDATE on an old-running series', () => {
        const events = feed(
            series(
                'standup',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY',
                'EXDATE;TZID=Europe/Athens:20261109T090000'
            )
        );
        expect(datesOf(events)).toEqual(['2026-11-02', '2026-11-16']);
    });

    it('counts occurrences from the first one when a rule has a COUNT', () => {
        const events = feed(
            // The 775th Monday from 2012-01-02 is 2026-11-02.
            series(
                'ends-in-window',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY;COUNT=775'
            ),
            series(
                'ended',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY;COUNT=10'
            )
        );
        expect(datesOf(events)).toEqual(['2026-11-02']);
    });

    it('stops a series at its UNTIL', () => {
        const events = feed(
            series(
                'ends-in-window',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY;UNTIL=20261110T000000Z'
            ),
            series(
                'ended',
                'DTSTART;TZID=Europe/Athens:20120102T090000',
                'DTEND;TZID=Europe/Athens:20120102T100000',
                'RRULE:FREQ=WEEKLY;UNTIL=20180101T000000Z'
            )
        );
        expect(datesOf(events)).toEqual(['2026-11-02', '2026-11-09']);
    });

    it('shows an old instance that was moved into the range', () => {
        const events = feed(
            series(
                'review',
                'DTSTART;TZID=Europe/Athens:20200106T100000',
                'DTEND;TZID=Europe/Athens:20200106T110000',
                'RRULE:FREQ=WEEKLY;UNTIL=20210201T000000Z'
            ),
            [
                'UID:review',
                'SUMMARY:review moved',
                'RECURRENCE-ID;TZID=Europe/Athens:20210104T100000',
                'DTSTART;TZID=Europe/Athens:20261111T150000',
                'DTEND;TZID=Europe/Athens:20261111T160000',
            ]
        );
        const range = eventsForRange(
            events,
            '2026-11-11',
            '2026-11-11',
            'Europe/Athens'
        );
        expect(range.map((e) => e.title)).toEqual(['review moved']);
    });

    it('leaves out an instance moved out of the range', () => {
        const events = feed(
            series(
                'review',
                'DTSTART;TZID=Europe/Athens:20200106T100000',
                'DTEND;TZID=Europe/Athens:20200106T110000',
                'RRULE:FREQ=WEEKLY'
            ),
            [
                'UID:review',
                'SUMMARY:review moved',
                'RECURRENCE-ID;TZID=Europe/Athens:20261109T100000',
                'DTSTART;TZID=Europe/Athens:20300101T150000',
                'DTEND;TZID=Europe/Athens:20300101T160000',
            ]
        );
        expect(datesOf(events, '2026-11-08', '2026-11-10')).toEqual([]);
    });

    it('shows a long occurrence that started before the range', () => {
        const events = feed(
            series(
                'trip',
                'DTSTART;VALUE=DATE:20120110',
                'DTEND;VALUE=DATE:20120120',
                'RRULE:FREQ=MONTHLY'
            ),
            series(
                'on-call',
                'DTSTART:20120101T120000Z',
                'DURATION:P10D',
                'RRULE:FREQ=WEEKLY'
            )
        );
        const range = eventsForRange(events, '2026-11-15', '2026-11-15', 'UTC');
        expect(range.find((e) => e.uid === 'trip')).toMatchObject({
            start: '2026-11-10',
            end: '2026-11-20',
        });
        expect(
            range.filter((e) => e.uid === 'on-call').map((e) => e.start)
        ).toEqual(['2026-11-08T12:00:00.000Z', '2026-11-15T12:00:00.000Z']);
    });

    it('finds an event whose printed date is days from the user date', () => {
        const events = feed(
            // 10:00 UTC on the 11th: 23:00 on the 10th in Pago Pago.
            series(
                'far-zone',
                'DTSTART;TZID=Pacific/Kiritimati:20261112T000000',
                'DTEND;TZID=Pacific/Kiritimati:20261112T003000'
            )
        );
        expect(
            datesOf(events, '2026-11-10', '2026-11-10', 'Pacific/Pago_Pago')
        ).toEqual(['2026-11-10']);
    });

    it('does not list one-off events from other years', () => {
        const events = feed(
            series('old', 'DTSTART:20120105T100000Z', 'DTEND:20120105T110000Z'),
            series('now', 'DTSTART:20261105T100000Z', 'DTEND:20261105T110000Z'),
            series(
                'later',
                'DTSTART:20301105T100000Z',
                'DTEND:20301105T110000Z'
            )
        );
        const range = eventsForRange(
            events,
            '2026-11-01',
            '2026-11-21',
            'Europe/Athens'
        );
        expect(range.map((e) => e.uid)).toEqual(['now']);
    });
});

describe('DST change days', () => {
    const dstEvents = parseCalendar(
        [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//test//EN',
            'BEGIN:VEVENT',
            'UID:autumn@test',
            'DTSTART;TZID=Europe/Athens:20261025T160000',
            'DTEND;TZID=Europe/Athens:20261025T170000',
            'SUMMARY:Dentist',
            'END:VEVENT',
            'BEGIN:VEVENT',
            'UID:spring@test',
            'DTSTART;TZID=Europe/Athens:20270328T160000',
            'DTEND;TZID=Europe/Athens:20270328T170000',
            'SUMMARY:Dentist',
            'END:VEVENT',
            'BEGIN:VEVENT',
            'UID:late@test',
            'DTSTART;TZID=Europe/Athens:20261025T230000',
            'DTEND;TZID=Europe/Athens:20261026T010000',
            'SUMMARY:Late show',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n')
    );

    it('keeps the clock time on the 25-hour day when clocks go back', () => {
        const day = eventsForDate(dstEvents, '2026-10-25', 'Europe/Athens');
        const dentist = day.find((e) => e.uid === 'autumn@test');
        expect([dentist.start_minute, dentist.end_minute]).toEqual([960, 1020]);
        const late = day.find((e) => e.uid === 'late@test');
        expect([late.start_minute, late.end_minute]).toEqual([1380, 1440]);
    });

    it('keeps the clock time on the 23-hour day when clocks go forward', () => {
        const dentist = eventsForDate(
            dstEvents,
            '2027-03-28',
            'Europe/Athens'
        ).find((e) => e.uid === 'spring@test');
        expect([dentist.start_minute, dentist.end_minute]).toEqual([960, 1020]);
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
        ).rejects.toThrow('CALDAV_ALLOW_PRIVATE_HOSTS');
    });

    it('fetches over keep-alive agents', async () => {
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
        ]);
        const get = jest.spyOn(axios, 'get').mockResolvedValue({
            status: 200,
            headers: {},
            data: ICS,
        });

        await expect(
            fetchFeed('https://calendar.example/basic.ics')
        ).resolves.toContain('BEGIN:VCALENDAR');

        const config = get.mock.calls[0][1];
        expect(config.httpsAgent.keepAlive).toBe(true);
        expect(config.httpAgent.keepAlive).toBe(true);
    });
});
