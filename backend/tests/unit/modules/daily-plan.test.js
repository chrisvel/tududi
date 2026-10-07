const {
    validateItems,
    resolvePlanDate,
} = require('../../../modules/daily-plan/service');

describe('validateItems', () => {
    it('keeps unscheduled items and back-to-back slots', () => {
        const items = validateItems([
            { task_uid: 'a', start_minute: 480, duration_minutes: 60 },
            { task_uid: 'b', start_minute: 540, duration_minutes: 30 },
            { task_uid: 'c' },
        ]);
        expect(items.map((i) => i.start_minute)).toEqual([480, 540, null]);
    });

    it('rejects overlaps using the default length when none is given', () => {
        expect(() =>
            validateItems([
                { task_uid: 'a', start_minute: 480 },
                { task_uid: 'b', start_minute: 500, duration_minutes: 15 },
            ])
        ).toThrow(/overlap/);
    });

    it('rejects out-of-range values', () => {
        expect(() =>
            validateItems([{ task_uid: 'a', start_minute: -5 }])
        ).toThrow();
        expect(() =>
            validateItems([{ task_uid: 'a', duration_minutes: 1 }])
        ).toThrow();
        expect(() =>
            validateItems([{ task_uid: 'a', start_minute: 12.5 }])
        ).toThrow();
        expect(() => validateItems('nope')).toThrow();
    });
});

describe('resolvePlanDate', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-24T22:30:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("uses the user's local date, not the server's", () => {
        expect(resolvePlanDate(undefined, 'Europe/Athens')).toBe('2026-09-25');
        expect(resolvePlanDate('today', 'America/New_York')).toBe('2026-09-24');
    });

    it('accepts an explicit date and rejects malformed ones', () => {
        expect(resolvePlanDate('2026-10-01', 'UTC')).toBe('2026-10-01');
        expect(() => resolvePlanDate('2026-13-01', 'UTC')).toThrow();
        expect(() => resolvePlanDate('tomorrow', 'UTC')).toThrow();
    });
});
