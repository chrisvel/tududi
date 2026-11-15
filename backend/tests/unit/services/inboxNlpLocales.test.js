const {
    parseDueDate,
    parseRecurrence,
} = require('../../../modules/inbox/nlpParsers');
const {
    processInboxItem,
} = require('../../../modules/inbox/inboxProcessingService');

// Tuesday 2026-11-10, 11:00 in Berlin
const NOW = new Date('2026-11-10T10:00:00Z');
const options = { referenceDate: NOW, timezone: 'Europe/Berlin' };
const german = { ...options, language: 'de' };

describe('inbox natural-language parsing in the user language', () => {
    beforeAll(() => {
        jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick'] });
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('parseDueDate in German', () => {
        it.each([
            ['Bericht abgeben heute', '2026-11-10', 'heute'],
            ['Arzt anrufen morgen', '2026-11-11', 'morgen'],
            ['Morgen Arzt anrufen', '2026-11-11', 'Morgen'],
            ['Einkaufen übermorgen', '2026-11-12', 'übermorgen'],
            ['Tisch buchen nächsten Freitag', '2026-11-20', 'nächsten Freitag'],
            ['Nachfassen in 3 Tagen', '2026-11-13', 'in 3 Tagen'],
            ['Urlaub buchen in 2 Wochen', '2026-11-24', 'in 2 Wochen'],
            [
                'Pass verlängern am 20. November',
                '2026-11-20',
                'am 20. November',
            ],
            ['Steuer 20.11.2026', '2026-11-20', '20.11.2026'],
            ['Steuer 20.11.', '2026-11-20', '20.11.'],
            ['Miete 31.1. zahlen', '2027-01-31', '31.1.'],
        ])('parses "%s"', (text, date, phrase) => {
            const result = parseDueDate(text, german);
            expect(result).toMatchObject({ date, text: phrase });
            expect(result.removable).toBe(true);
        });

        it.each([
            ['Bericht bis Montag', 'bis Montag'],
            ['Bericht bis zum 20. November', 'bis zum 20. November'],
            ['Rechnung fällig am Freitag', 'fällig am Freitag'],
            ['Antwort spätestens Freitag', 'spätestens Freitag'],
        ])('takes the lead word with the phrase in "%s"', (text, phrase) => {
            const result = parseDueDate(text, german);
            expect(result.text).toBe(phrase);
            expect(text.slice(result.index)).toBe(phrase);
        });

        it.each([
            'Das ist so gut',
            'Kuchen backen Sa',
            'Guten Morgen sagen',
            'am Morgen joggen',
            'Montagearbeit planen',
            'Version 1.2.3 testen',
            'Im Mai verreisen',
            '#morgen ist ein Tag',
        ])('ignores "%s"', (text) => {
            expect(parseDueDate(text, german)).toBeNull();
        });

        it('does not read a short weekday form inside a word', () => {
            const result = parseDueDate('Müll rausbringen morgen früh', german);
            expect(result).toMatchObject({
                date: '2026-11-11',
                text: 'morgen',
            });
        });

        it('parses the time but keeps a phrase with a time in the title', () => {
            const result = parseDueDate('Zahnarzt morgen 15 Uhr', german);
            expect(result.date).toBe('2026-11-11');
            expect(result.time).toBe('15:00');
            expect(result.removable).toBe(false);
        });

        it.each([
            ['Call plumber tomorrow', '2026-11-11', 'tomorrow'],
            ['Book table next fri', '2026-11-20', 'next fri'],
            ['Send report by friday', '2026-11-13', 'by friday'],
        ])('still parses English "%s"', (text, date, phrase) => {
            expect(parseDueDate(text, german)).toMatchObject({
                date,
                text: phrase,
            });
        });

        it('leaves German alone for an English user', () => {
            expect(parseDueDate('Arzt anrufen morgen', options)).toBeNull();
            expect(
                parseDueDate('Arzt anrufen morgen', {
                    ...options,
                    language: 'en',
                })
            ).toBeNull();
        });
    });

    describe('parseDueDate in other languages', () => {
        it.each([
            ['fr', 'appeler le plombier demain', '2026-11-11', 'demain'],
            ['es', 'llamar al fontanero mañana', '2026-11-11', 'mañana'],
            ['it', 'chiamare domani', '2026-11-11', 'domani'],
            ['nl', 'loodgieter bellen morgen', '2026-11-11', 'morgen'],
            ['pt', 'ligar amanhã', '2026-11-11', 'amanhã'],
            ['sv', 'ringa imorgon', '2026-11-11', 'imorgon'],
            ['fi', 'soita huomenna', '2026-11-11', 'huomenna'],
            ['ru', 'позвонить завтра', '2026-11-11', 'завтра'],
            ['ua', 'подзвонити завтра', '2026-11-11', 'завтра'],
            ['jp', '明日電話する', '2026-11-11', '明日'],
            ['zh', '明天打电话', '2026-11-11', '明天'],
            ['vi', 'gọi ngày mai', '2026-11-11', 'ngày mai'],
        ])('parses %s "%s"', (language, text, date, phrase) => {
            expect(parseDueDate(text, { ...options, language })).toMatchObject({
                date,
                text: phrase,
            });
        });

        it.each([
            ['fr', 'aller à la mer'],
            ['fr', 'jeu vidéo'],
            ['es', 'ir al mar'],
            ['es', 'correr por la mañana'],
            ['nl', 'goede morgen zeggen'],
            ['it', 'andare al mar'],
            ['pt', 'ver o sol'],
            ['fi', 'ma ti su'],
        ])('ignores %s "%s"', (language, text) => {
            expect(parseDueDate(text, { ...options, language })).toBeNull();
        });

        it('falls back to English for a language without a parser', () => {
            expect(
                parseDueDate('Call plumber tomorrow', {
                    ...options,
                    language: 'el',
                })
            ).toMatchObject({ date: '2026-11-11', text: 'tomorrow' });
        });
    });

    describe('parseRecurrence in German', () => {
        const weekly = (weekdays) => ({
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekdays: weekdays,
        });

        it.each([
            [
                'Blumen gießen täglich',
                'täglich',
                { recurrence_type: 'daily', recurrence_interval: 1 },
                '2026-11-10',
            ],
            [
                'Täglich Tabletten nehmen',
                'Täglich',
                { recurrence_type: 'daily', recurrence_interval: 1 },
                '2026-11-10',
            ],
            [
                'Putzen wöchentlich',
                'wöchentlich',
                { recurrence_type: 'weekly', recurrence_interval: 1 },
                '2026-11-10',
            ],
            [
                'Abrechnung monatlich',
                'monatlich',
                { recurrence_type: 'monthly', recurrence_interval: 1 },
                '2026-11-10',
            ],
            [
                'Tagebuch jeden Tag',
                'jeden Tag',
                { recurrence_type: 'daily', recurrence_interval: 1 },
                '2026-11-10',
            ],
            [
                'Putzen jede Woche',
                'jede Woche',
                { recurrence_type: 'weekly', recurrence_interval: 1 },
                '2026-11-10',
            ],
            ['Yoga jeden Montag', 'jeden Montag', weekly([1]), '2026-11-16'],
            [
                'Sport jeden Montag, Mittwoch und Freitag',
                'jeden Montag, Mittwoch und Freitag',
                weekly([1, 3, 5]),
                '2026-11-11',
            ],
            ['Sport montags', 'montags', weekly([1]), '2026-11-16'],
            [
                'Sport dienstags und donnerstags',
                'dienstags und donnerstags',
                weekly([2, 4]),
                '2026-11-12',
            ],
            [
                'Standup werktags',
                'werktags',
                weekly([1, 2, 3, 4, 5]),
                '2026-11-11',
            ],
            [
                'Blumen gießen alle 2 Wochen',
                'alle 2 Wochen',
                { recurrence_type: 'weekly', recurrence_interval: 2 },
                '2026-11-10',
            ],
            [
                'Laufen alle drei Tage',
                'alle drei Tage',
                { recurrence_type: 'daily', recurrence_interval: 3 },
                '2026-11-10',
            ],
            [
                'Laufen jeden zweiten Tag',
                'jeden zweiten Tag',
                { recurrence_type: 'daily', recurrence_interval: 2 },
                '2026-11-10',
            ],
            [
                'Review jeden ersten Montag',
                'jeden ersten Montag',
                {
                    recurrence_type: 'monthly_weekday',
                    recurrence_weekday: 1,
                    recurrence_week_of_month: 1,
                },
                '2026-12-07',
            ],
            [
                'Review jeden 2. Freitag im Monat',
                'jeden 2. Freitag im Monat',
                {
                    recurrence_type: 'monthly_weekday',
                    recurrence_weekday: 5,
                    recurrence_week_of_month: 2,
                },
                '2026-11-13',
            ],
            [
                'Abrechnung jeden Monatsletzten',
                'jeden Monatsletzten',
                { recurrence_type: 'monthly_last_day' },
                '2026-11-30',
            ],
            [
                'Miete jeden Monat am 15.',
                'jeden Monat am 15.',
                { recurrence_type: 'monthly', recurrence_month_day: 15 },
                '2026-11-15',
            ],
            [
                'Miete jeden 15.',
                'jeden 15.',
                { recurrence_type: 'monthly', recurrence_month_day: 15 },
                '2026-11-15',
            ],
        ])('parses "%s"', (text, phrase, recurrence, date) => {
            const result = parseRecurrence(text, german);
            expect(result.text).toBe(phrase);
            expect(result.recurrence).toMatchObject(recurrence);
            expect(result.date).toBe(date);
        });

        it.each([
            'Täglicher Bericht',
            'wöchentlichen Bericht schreiben',
            'Bericht täglich prüfen lassen',
            'so ist das',
            'alle Tage wieder',
        ])('ignores "%s"', (text) => {
            expect(parseRecurrence(text, german)).toBeNull();
        });

        it('still parses English', () => {
            expect(
                parseRecurrence('Water plants every monday', german).recurrence
            ).toMatchObject(weekly([1]));
        });

        it('leaves German alone for an English user', () => {
            expect(parseRecurrence('Yoga jeden Montag', options)).toBeNull();
        });
    });

    describe('processInboxItem', () => {
        it('cuts a German date from the title', () => {
            const result = processInboxItem(
                'Bericht abgeben bis Montag',
                german
            );
            expect(result.parsed_due_date).toBe('2026-11-16');
            expect(result.parsed_date_text).toBe('bis Montag');
            expect(result.cleaned_content).toBe('Bericht abgeben');
        });

        it('cuts a German repeat from the title', () => {
            const result = processInboxItem('Yoga jeden Montag #sport', german);
            expect(result.parsed_recurrence).toMatchObject({
                recurrence_type: 'weekly',
                recurrence_weekdays: [1],
            });
            expect(result.cleaned_content).toBe('Yoga');
        });
    });
});
