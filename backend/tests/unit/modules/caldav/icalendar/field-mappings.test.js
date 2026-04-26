const {
    STATUS_TASKNOTETAKER_TO_ICAL,
    STATUS_ICAL_TO_TASKNOTETAKER,
    tasknotetakerToIcalPriority,
    icalToTaskNoteTakerPriority,
    WEEKDAY_MAP,
    WEEKDAY_REVERSE_MAP,
} = require('../../../../../modules/caldav/icalendar/field-mappings');

describe('CalDAV Field Mappings', () => {
    describe('Status Mappings', () => {
        it('should map tasknotetaker statuses to iCalendar statuses', () => {
            expect(STATUS_TASKNOTETAKER_TO_ICAL[0]).toBe('NEEDS-ACTION');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[1]).toBe('IN-PROCESS');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[2]).toBe('COMPLETED');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[3]).toBe('COMPLETED');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[4]).toBe('NEEDS-ACTION');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[5]).toBe('CANCELLED');
            expect(STATUS_TASKNOTETAKER_TO_ICAL[6]).toBe('NEEDS-ACTION');
        });

        it('should map iCalendar statuses to tasknotetaker statuses', () => {
            expect(STATUS_ICAL_TO_TASKNOTETAKER['NEEDS-ACTION']).toBe(0);
            expect(STATUS_ICAL_TO_TASKNOTETAKER['IN-PROCESS']).toBe(1);
            expect(STATUS_ICAL_TO_TASKNOTETAKER['COMPLETED']).toBe(2);
            expect(STATUS_ICAL_TO_TASKNOTETAKER['CANCELLED']).toBe(5);
        });
    });

    describe('Priority Mappings', () => {
        describe('tasknotetakerToIcalPriority', () => {
            it('should map tasknotetaker Low (0) to iCal 7', () => {
                expect(tasknotetakerToIcalPriority(0)).toBe(7);
            });

            it('should map tasknotetaker Medium (1) to iCal 5', () => {
                expect(tasknotetakerToIcalPriority(1)).toBe(5);
            });

            it('should map tasknotetaker High (2) to iCal 3', () => {
                expect(tasknotetakerToIcalPriority(2)).toBe(3);
            });

            it('should return 0 for null priority', () => {
                expect(tasknotetakerToIcalPriority(null)).toBe(0);
                expect(tasknotetakerToIcalPriority(undefined)).toBe(0);
            });
        });

        describe('icalToTaskNoteTakerPriority', () => {
            it('should map iCal 1-3 to High (2)', () => {
                expect(icalToTaskNoteTakerPriority(1)).toBe(2);
                expect(icalToTaskNoteTakerPriority(2)).toBe(2);
                expect(icalToTaskNoteTakerPriority(3)).toBe(2);
            });

            it('should map iCal 4-6 to Medium (1)', () => {
                expect(icalToTaskNoteTakerPriority(4)).toBe(1);
                expect(icalToTaskNoteTakerPriority(5)).toBe(1);
                expect(icalToTaskNoteTakerPriority(6)).toBe(1);
            });

            it('should map iCal 7-9 to Low (0)', () => {
                expect(icalToTaskNoteTakerPriority(7)).toBe(0);
                expect(icalToTaskNoteTakerPriority(8)).toBe(0);
                expect(icalToTaskNoteTakerPriority(9)).toBe(0);
            });

            it('should return 0 for undefined/null/0 priority', () => {
                expect(icalToTaskNoteTakerPriority(null)).toBe(0);
                expect(icalToTaskNoteTakerPriority(undefined)).toBe(0);
                expect(icalToTaskNoteTakerPriority(0)).toBe(0);
            });
        });

        it('should maintain inverse relationship', () => {
            expect(icalToTaskNoteTakerPriority(tasknotetakerToIcalPriority(0))).toBe(0);
            expect(icalToTaskNoteTakerPriority(tasknotetakerToIcalPriority(1))).toBe(1);
            expect(icalToTaskNoteTakerPriority(tasknotetakerToIcalPriority(2))).toBe(2);
        });
    });

    describe('Weekday Mappings', () => {
        it('should map tasknotetaker weekdays to iCalendar weekdays', () => {
            expect(WEEKDAY_MAP[0]).toBe('SU');
            expect(WEEKDAY_MAP[1]).toBe('MO');
            expect(WEEKDAY_MAP[2]).toBe('TU');
            expect(WEEKDAY_MAP[3]).toBe('WE');
            expect(WEEKDAY_MAP[4]).toBe('TH');
            expect(WEEKDAY_MAP[5]).toBe('FR');
            expect(WEEKDAY_MAP[6]).toBe('SA');
        });

        it('should map iCalendar weekdays to tasknotetaker weekdays', () => {
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
                const tasknotetakerDay = WEEKDAY_REVERSE_MAP[icalDay];
                expect(tasknotetakerDay).toBe(parseInt(key, 10));
            });
        });
    });
});
