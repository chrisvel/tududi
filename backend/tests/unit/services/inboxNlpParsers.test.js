const {
    parseDueDate,
    parseRecurrence,
    parsePersonRef,
} = require('../../../modules/inbox/nlpParsers');
const {
    processInboxItem,
} = require('../../../modules/inbox/inboxProcessingService');

// Friday 2026-09-25, 13:00 in Athens
const NOW = new Date('2026-09-25T10:00:00Z');
const options = { referenceDate: NOW, timezone: 'Europe/Athens' };

describe('inbox natural-language parsing', () => {
    beforeAll(() => {
        jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick'] });
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('parseDueDate', () => {
        it.each([
            ['Call plumber tomorrow', '2026-09-26', 'tomorrow'],
            ['Submit form today', '2026-09-25', 'today'],
            ['Book table next fri', '2026-10-02', 'next fri'],
            ['Follow up in 3 days', '2026-09-28', 'in 3 days'],
            ['Renew passport Oct 12', '2026-10-12', 'Oct 12'],
            ['Pay invoice on monday', '2026-09-28', 'on monday'],
        ])('parses "%s"', (text, date, phrase) => {
            const result = parseDueDate(text, options);
            expect(result).toMatchObject({ date, text: phrase });
            expect(result.removable).toBe(true);
        });

        it.each([
            'I may call later',
            'Buy 3 apples',
            'Walk in the sun',
            'Email me@example.com',
            '#tomorrow is a tag',
            '+"Tomorrow Project" stuff',
            'Read https://example.com/2026/10/12/post',
            'Plan the march',
        ])('ignores "%s"', (text) => {
            expect(parseDueDate(text, options)).toBeNull();
        });

        it('keeps a phrase with a time in the title', () => {
            const result = parseDueDate('Dentist tomorrow at 3pm', options);
            expect(result.date).toBe('2026-09-26');
            expect(result.removable).toBe(false);
        });

        it('uses the user timezone for "today"', () => {
            const lateEvening = new Date('2026-09-25T22:30:00Z');
            expect(
                parseDueDate('Call today', {
                    referenceDate: lateEvening,
                    timezone: 'Europe/Athens',
                }).date
            ).toBe('2026-09-26');
            expect(
                parseDueDate('Call today', {
                    referenceDate: lateEvening,
                    timezone: 'UTC',
                }).date
            ).toBe('2026-09-25');
        });

        it('resolves relative dates against the reference date', () => {
            const captured = new Date('2026-09-20T09:00:00Z');
            expect(
                parseDueDate('Call tomorrow', {
                    referenceDate: captured,
                    timezone: 'UTC',
                }).date
            ).toBe('2026-09-21');
        });
    });

    describe('parseRecurrence', () => {
        it.each([
            [
                'Journal every day',
                { recurrence_type: 'daily', recurrence_interval: 1 },
                '2026-09-25',
            ],
            [
                'Water plants every 3 days',
                { recurrence_type: 'daily', recurrence_interval: 3 },
                '2026-09-25',
            ],
            [
                'Call mom every other week',
                { recurrence_type: 'weekly', recurrence_interval: 2 },
                '2026-09-25',
            ],
            [
                'Standup every weekday',
                {
                    recurrence_type: 'weekly',
                    recurrence_weekdays: [1, 2, 3, 4, 5],
                },
                '2026-09-28',
            ],
            [
                'Gym every mon, wed and fri',
                { recurrence_type: 'weekly', recurrence_weekdays: [1, 3, 5] },
                '2026-09-28',
            ],
            [
                'Pay rent every month on the 1st',
                { recurrence_type: 'monthly', recurrence_month_day: 1 },
                '2026-10-01',
            ],
            [
                'Review every last friday',
                {
                    recurrence_type: 'monthly_weekday',
                    recurrence_weekday: 5,
                    recurrence_week_of_month: 5,
                },
                '2026-09-25',
            ],
            [
                'Invoice every first monday',
                {
                    recurrence_type: 'monthly_weekday',
                    recurrence_weekday: 1,
                    recurrence_week_of_month: 1,
                },
                '2026-10-05',
            ],
            [
                'Report every last day of the month',
                { recurrence_type: 'monthly_last_day' },
                '2026-09-30',
            ],
            [
                'Journal daily',
                { recurrence_type: 'daily', recurrence_interval: 1 },
                '2026-09-25',
            ],
        ])('parses "%s"', (text, recurrence, date) => {
            const result = parseRecurrence(text, options);
            expect(result.recurrence).toMatchObject(recurrence);
            expect(result.date).toBe(date);
        });

        it('leaves "weekly" alone inside a title', () => {
            expect(parseRecurrence('Write weekly report', options)).toBeNull();
        });
    });

    describe('parsePersonRef', () => {
        it('parses a single-word name', () => {
            expect(parsePersonRef('Call @Maria about it')).toEqual({
                name: 'Maria',
                text: '@Maria',
                index: 5,
            });
        });

        it('parses a quoted full name', () => {
            expect(parsePersonRef('Meet @"Anna Smith" soon')).toMatchObject({
                name: 'Anna Smith',
                text: '@"Anna Smith"',
            });
        });

        it('drops trailing punctuation', () => {
            expect(parsePersonRef('Ask @Maria, then leave').name).toBe('Maria');
        });

        it('ignores email addresses', () => {
            expect(parsePersonRef('Email bob@example.com')).toBeNull();
        });
    });

    describe('processInboxItem', () => {
        it('strips the date and suggests a task', () => {
            const result = processInboxItem(
                'Call plumber tomorrow #home',
                options
            );
            expect(result).toMatchObject({
                cleaned_content: 'Call plumber',
                parsed_due_date: '2026-09-26',
                parsed_date_text: 'tomorrow',
                parsed_recurrence: null,
                suggested_type: 'task',
                suggested_reason: 'date_detected',
            });
        });

        it('returns recurrence with its first due date', () => {
            const result = processInboxItem(
                'Pay rent every month on the 1st +Home',
                options
            );
            expect(result.cleaned_content).toBe('Pay rent');
            expect(result.parsed_due_date).toBe('2026-10-01');
            expect(result.parsed_recurrence).toMatchObject({
                recurrence_type: 'monthly',
                recurrence_month_day: 1,
            });
        });

        it('skips dates when parseDates is false', () => {
            const result = processInboxItem('Call plumber tomorrow', {
                ...options,
                parseDates: false,
            });
            expect(result.parsed_due_date).toBeNull();
            expect(result.cleaned_content).toBe('Call plumber tomorrow');
            expect(result.suggested_type).toBeNull();
        });

        it('keeps an unresolved @person in the title', () => {
            const result = processInboxItem('Call @nobody', options);
            expect(result.parsed_person).toBe('nobody');
            expect(result.cleaned_content).toBe('Call @nobody');
            expect(result.suggested_type).toBeNull();
        });

        it('strips a resolved @person and suggests a task', () => {
            const result = processInboxItem('Call @"Anna Smith" +Home', {
                ...options,
                personResolved: true,
            });
            expect(result.cleaned_content).toBe('Call');
            expect(result.parsed_projects).toEqual(['Home']);
            expect(result.suggested_reason).toBe('person_detected');
        });

        it('still treats a URL with a date as a bookmark candidate', () => {
            const result = processInboxItem(
                'https://example.com read tomorrow',
                options
            );
            expect(result.suggested_reason).toBe('url_detected');
        });
    });
});
