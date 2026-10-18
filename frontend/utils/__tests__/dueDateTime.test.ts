import { fromDueParts, toDueParts } from '../dueDateTime';

describe('dueDateTime', () => {
    it('round-trips a date with a time', () => {
        const iso = fromDueParts('2026-10-15', '15:30');
        expect(toDueParts(iso)).toEqual({ date: '2026-10-15', time: '15:30' });
    });

    it('treats midnight as a whole-day due date', () => {
        const iso = fromDueParts('2026-10-15', null);
        expect(toDueParts(iso)).toEqual({ date: '2026-10-15', time: null });
    });

    it('returns empty parts for an empty value', () => {
        expect(fromDueParts(null, '15:30')).toBe('');
        expect(toDueParts('')).toEqual({ date: null, time: null });
    });
});
