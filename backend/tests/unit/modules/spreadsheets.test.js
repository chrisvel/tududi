const {
    detectDateOrder,
    parseDateCell,
    parseStatusCell,
    parsePriorityCell,
    parseEstimateCell,
    splitList,
} = require('../../../modules/spreadsheets/core/values');
const {
    suggestMapping,
} = require('../../../modules/spreadsheets/core/columns');
const {
    detectDelimiter,
    readSpreadsheet,
    writeCsv,
} = require('../../../modules/spreadsheets/core/files');
const { Task } = require('../../../models');

describe('spreadsheet values', () => {
    it('reads ISO, numeric and written-out dates', () => {
        expect(parseDateCell('2026-11-20')).toEqual({
            date: '2026-11-20',
            time: null,
        });
        expect(parseDateCell('2026-11-20T14:30:00Z')).toEqual({
            date: '2026-11-20',
            time: '14:30',
        });
        expect(parseDateCell('03/04/2026', 'dmy').date).toBe('2026-04-03');
        expect(parseDateCell('03/04/2026', 'mdy').date).toBe('2026-03-04');
        expect(parseDateCell('3.4.26 9:15', 'dmy')).toEqual({
            date: '2026-04-03',
            time: '09:15',
        });
        expect(parseDateCell('4/3/2026 2:00 PM', 'mdy')).toEqual({
            date: '2026-04-03',
            time: '14:00',
        });
        expect(parseDateCell('12 March 2027').date).toBe('2027-03-12');
        expect(parseDateCell('31/02/2026', 'dmy')).toEqual({
            error: 'invalid_date',
        });
        expect(parseDateCell('soon')).toEqual({ error: 'invalid_date' });
        expect(parseDateCell('')).toBeNull();
    });

    it('settles day-first or month-first from the whole column', () => {
        expect(detectDateOrder(['01/02/2026', '25/02/2026'])).toBe('dmy');
        expect(detectDateOrder(['01/02/2026', '02/25/2026'])).toBe('mdy');
        expect(detectDateOrder(['01/02/2026', '03/04/2026'])).toBeNull();
    });

    it('understands status words, translations and percentages', () => {
        expect(parseStatusCell('Done')).toBe(Task.STATUS.DONE);
        expect(parseStatusCell('working on it')).toBe(Task.STATUS.IN_PROGRESS);
        expect(parseStatusCell('On hold')).toBe(Task.STATUS.WAITING);
        expect(parseStatusCell('Ολοκληρώθηκε')).toBe(Task.STATUS.DONE);
        expect(parseStatusCell('50%')).toBe(Task.STATUS.IN_PROGRESS);
        expect(parseStatusCell('100 %')).toBe(Task.STATUS.DONE);
        expect(parseStatusCell('Approved')).toBeUndefined();
        expect(parseStatusCell('')).toBeNull();
    });

    it('understands priority words', () => {
        expect(parsePriorityCell('Urgent')).toBe(Task.PRIORITY.HIGH);
        expect(parsePriorityCell('normal')).toBe(Task.PRIORITY.MEDIUM);
        expect(parsePriorityCell('P3')).toBe(Task.PRIORITY.LOW);
        expect(parsePriorityCell('whenever')).toBeUndefined();
    });

    it('reads estimates in minutes, hours and days', () => {
        expect(parseEstimateCell('90')).toEqual({ minutes: 90 });
        expect(parseEstimateCell('1h 30m')).toEqual({ minutes: 90 });
        expect(parseEstimateCell('1,5h')).toEqual({ minutes: 90 });
        expect(parseEstimateCell('2:15')).toEqual({ minutes: 135 });
        expect(parseEstimateCell('3 days')).toEqual({
            error: 'estimate_out_of_range',
        });
        expect(parseEstimateCell('a while')).toEqual({
            error: 'invalid_estimate',
        });
    });

    it('splits lists on commas, semicolons and pipes', () => {
        expect(splitList('#site, phase 1;urgent | ')).toEqual([
            'site',
            'phase 1',
            'urgent',
        ]);
    });
});

describe('spreadsheet columns', () => {
    it('maps each field to its best header and keeps unknown columns in the note', () => {
        expect(
            suggestMapping(
                ['Parent', 'Parent UID', 'Deadline', 'Due date', 'Budget', ''],
                [['a', 'b', 'c', 'd', '1000', '']]
            )
        ).toEqual([
            'ignore',
            'parent',
            'ignore',
            'due',
            'note_append',
            'ignore',
        ]);
    });

    it('matches exported headers in other languages', () => {
        const mapping = suggestMapping(['Όνομα', 'Προτεραιότητα'], []);
        expect(mapping[0]).toBe('name');
    });
});

describe('spreadsheet files', () => {
    it('detects the separator', () => {
        expect(detectDelimiter('a;b;c\n1;2,5;3')).toBe(';');
        expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
        expect(detectDelimiter('"a, b",c\n1,2')).toBe(',');
    });

    it('reads Windows-1252 CSV and drops empty rows', async () => {
        const buffer = Buffer.from('Name;Note\r\nCaf\xe9;\r\n;\r\n', 'latin1');
        const [sheet] = await readSpreadsheet(buffer, 'x.csv');
        expect(sheet.rows).toEqual([
            ['Name', 'Note'],
            ['Café', ''],
        ]);
        expect(sheet.row_numbers).toEqual([1, 2]);
    });

    it('guards exported cells against formulas and strips the guard on import', async () => {
        const csv = writeCsv(['Name'], [['=SUM(A1)'], ['a, "b"']]);
        expect(csv.toString('utf8')).toBe(
            '﻿Name\r\n\'=SUM(A1)\r\n"a, ""b"""\r\n'
        );
        const [sheet] = await readSpreadsheet(csv, 'x.csv');
        expect(sheet.rows[1]).toEqual(['=SUM(A1)']);
        expect(sheet.rows[2]).toEqual(['a, "b"']);
    });
});
