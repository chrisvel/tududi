const {
    STATUS_TUDUDI_TO_ICAL,
    STATUS_ICAL_TO_TUDUDI,
    tududiToIcalPriority,
    icalToTududiPriority,
    WEEKDAY_MAP,
    WEEKDAY_REVERSE_MAP,
} = require('../../../../../modules/caldav/icalendar/field-mappings');

describe('CalDAV Field Mappings', () => {
    describe('Status Mappings', () => {
        it('should map tududi statuses to iCalendar statuses', () => {
            expect(STATUS_TUDUDI_TO_ICAL[0]).toBe('NEEDS-ACTION');
            expect(STATUS_TUDUDI_TO_ICAL[1]).toBe('IN-PROCESS');
            expect(STATUS_TUDUDI_TO_ICAL[2]).toBe('COMPLETED');
            expect(STATUS_TUDUDI_TO_ICAL[3]).toBe('COMPLETED');
            expect(STATUS_TUDUDI_TO_ICAL[4]).toBe('NEEDS-ACTION');
            expect(STATUS_TUDUDI_TO_ICAL[5]).toBe('CANCELLED');
            expect(STATUS_TUDUDI_TO_ICAL[6]).toBe('NEEDS-ACTION');
        });

        it('should map iCalendar statuses to tududi statuses', () => {
            expect(STATUS_ICAL_TO_TUDUDI['NEEDS-ACTION']).toBe(0);
            expect(STATUS_ICAL_TO_TUDUDI['IN-PROCESS']).toBe(1);
            expect(STATUS_ICAL_TO_TUDUDI['COMPLETED']).toBe(2);
            expect(STATUS_ICAL_TO_TUDUDI['CANCELLED']).toBe(5);
        });
    });

    describe('Priority Mappings', () => {
        describe('tududiToIcalPriority', () => {
            it('should map tududi Low (0) to iCal 7', () => {
                expect(tududiToIcalPriority(0)).toBe(7);
            });

            it('should map tududi Medium (1) to iCal 5', () => {
                expect(tududiToIcalPriority(1)).toBe(5);
            });

            it('should map tududi High (2) to iCal 3', () => {
                expect(tududiToIcalPriority(2)).toBe(3);
            });

            it('should return 0 for null priority', () => {
                expect(tududiToIcalPriority(null)).toBe(0);
                expect(tududiToIcalPriority(undefined)).toBe(0);
            });
        });

        describe('icalToTududiPriority', () => {
            it('should map iCal 1-3 to High (2)', () => {
                expect(icalToTududiPriority(1)).toBe(2);
                expect(icalToTududiPriority(2)).toBe(2);
                expect(icalToTududiPriority(3)).toBe(2);
            });

            it('should map iCal 4-6 to Medium (1)', () => {
                expect(icalToTududiPriority(4)).toBe(1);
                expect(icalToTududiPriority(5)).toBe(1);
                expect(icalToTududiPriority(6)).toBe(1);
            });

            it('should map iCal 7-9 to Low (0)', () => {
                expect(icalToTududiPriority(7)).toBe(0);
                expect(icalToTududiPriority(8)).toBe(0);
                expect(icalToTududiPriority(9)).toBe(0);
            });

            it('should return 0 for undefined/null/0 priority', () => {
                expect(icalToTududiPriority(null)).toBe(0);
                expect(icalToTududiPriority(undefined)).toBe(0);
                expect(icalToTududiPriority(0)).toBe(0);
            });
        });

        it('should maintain inverse relationship', () => {
            expect(icalToTududiPriority(tududiToIcalPriority(0))).toBe(0);
            expect(icalToTududiPriority(tududiToIcalPriority(1))).toBe(1);
            expect(icalToTududiPriority(tududiToIcalPriority(2))).toBe(2);
        });
    });

    describe('Weekday Mappings', () => {
        it('should map tududi weekdays to iCalendar weekdays', () => {
            expect(WEEKDAY_MAP[0]).toBe('SU');
            expect(WEEKDAY_MAP[1]).toBe('MO');
            expect(WEEKDAY_MAP[2]).toBe('TU');
            expect(WEEKDAY_MAP[3]).toBe('WE');
            expect(WEEKDAY_MAP[4]).toBe('TH');
            expect(WEEKDAY_MAP[5]).toBe('FR');
            expect(WEEKDAY_MAP[6]).toBe('SA');
        });

        it('should map iCalendar weekdays to tududi weekdays', () => {
            expect(WEEKDAY_REVERSE_MAP['SU']).toBe(0);
            expect(WEEKDAY_REVERSE_MAP['MO']).toBe(1);
            expect(WEEKDAY_REVERSE_MAP['TU']).toBe(2);
            expect(WEEKDAY_REVERSE_MAP['WE']).toBe(3);
            expect(WEEKDAY_REVERSE_MAP['TH']).toBe(4);
            expect(WEEKDAY_REVERSE_MAP['FR']).toBe(5);
            expect(WEEKDAY_REVERSE_MAP['SA']).toBe(6);
        });

        it('should maintain reverse relationship', () => {
            Object.keys(WEEKDAY_MAP).forEach((key) => {
                const icalDay = WEEKDAY_MAP[key];
                const tududiDay = WEEKDAY_REVERSE_MAP[icalDay];
                expect(tududiDay).toBe(parseInt(key, 10));
            });
        });
    });
});
