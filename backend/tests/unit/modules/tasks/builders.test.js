const {
    calculateInitialDueDate,
} = require('../../../../modules/tasks/core/builders');

describe('calculateInitialDueDate', () => {
    describe('Weekly recurrence with multiple weekdays', () => {
        it('should find next occurrence when today is Monday and target is Tue/Thu', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [2, 4],
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });

        it('should find next occurrence among three weekdays (Mon/Wed/Fri)', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 3, 5],
            });

            expect(result).toBe('2026-03-25');
            global.Date = RealDate;
        });

        it('should wrap to first day of next week when today is after all weekdays', () => {
            const saturday = new Date(Date.UTC(2026, 2, 28, 0, 0, 0, 0));
            expect(saturday.getUTCDay()).toBe(6);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(saturday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => saturday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 3, 5],
            });

            expect(result).toBe('2026-03-30');
            global.Date = RealDate;
        });

        it('should handle unsorted weekdays array', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [5, 1, 3],
            });

            expect(result).toBe('2026-03-25');
            global.Date = RealDate;
        });

        it('should work with single-element array like single weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [5],
            });

            expect(result).toBe('2026-03-27');
            global.Date = RealDate;
        });

        it('should parse JSON string for recurrence_weekdays', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: '[2, 4]',
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });

        it('should prioritize recurrence_weekdays over recurrence_weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekday: 0,
                recurrence_weekdays: [2, 4],
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });
    });

    describe('Weekly recurrence with non-UTC timezone (issue #1415)', () => {
        it('uses the user local weekday, not the server UTC weekday, to find the next occurrence', () => {
            // This instant is Thursday in UTC but already Friday in Asia/Tokyo
            // (UTC+9) - the exact divergence that used to corrupt the "next
            // weekday in pattern" calculation for positive-UTC-offset users.
            const instant = new Date(Date.UTC(2026, 7, 27, 16, 0, 0, 0));
            expect(instant.getUTCDay()).toBe(4); // Thursday in UTC

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(instant);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](i) {
                    return i instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => instant.getTime();

            const result = calculateInitialDueDate(
                {
                    recurrence_type: 'weekly',
                    recurrence_weekdays: [1, 2, 3, 4, 5],
                },
                'Asia/Tokyo'
            );

            // Local "today" is Friday (already in the pattern); the next
            // occurrence strictly after today is Monday 2026-08-31, not
            // 2026-08-28 (which is what the server-UTC-only calculation
            // would incorrectly produce).
            expect(result).toBe('2026-08-31');
            global.Date = RealDate;
        });
    });

    describe('Weekly recurrence with single weekday (backward compatibility)', () => {
        it('should calculate correct due date for single weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekday: 5,
            });

            expect(result).toBe('2026-03-27');
            global.Date = RealDate;
        });
    });
});
