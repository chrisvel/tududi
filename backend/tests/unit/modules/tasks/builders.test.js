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
