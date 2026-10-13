const rules = require('../../../../modules/ltd-focus/rules');
describe('T-1201 task pomodoro rules', () => {
    it('inherits 25, then user preference, then the task override', () => {
        expect(rules.length({}, {})).toBe(25);
        expect(rules.length({}, { focus_minutes: 30 })).toBe(30);
        expect(rules.length({ focus_minutes: 40 }, { focus_minutes: 30 })).toBe(
            40
        );
        expect(rules.settings()).toEqual(rules.DEFAULTS);
    });
    it('rounds the minute estimate and leaves an empty estimate unknown', () => {
        expect(rules.target(50, 25)).toBe(2);
        expect(rules.target(null, 25)).toBeNull();
        expect(rules.target(5, 90)).toBe(1);
    });
    it('keeps interrupted minutes, excludes open time, and gives only full intervals dots', () => {
        const s = {
            ended_at: new Date(),
            planned_minutes: 25,
            actual_minutes: 25,
            interrupted: false,
        };
        expect(
            rules.totals([
                s,
                { ...s, actual_minutes: 12, interrupted: true },
                { ...s, ended_at: null },
            ])
        ).toEqual({ spent_minutes: 37, completed_count: 1 });
        expect(rules.complete({ ...s, actual_minutes: 24 })).toBe(true);
        expect(rules.complete({ ...s, actual_minutes: 23 })).toBe(false);
    });
    it('rejects invalid steps with HTTP 400', () => {
        for (const n of [1, 26, 95, '25']) {
            expect(() => rules.parseLength(n)).toThrow(
                expect.objectContaining({ statusCode: 400 })
            );
        }
        expect(rules.parseLength(null)).toBeNull();
    });
});
