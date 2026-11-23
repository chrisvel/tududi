'use strict';

const { Op } = require('sequelize');
const moment = require('moment-timezone');
const searchService = require('../../../../modules/search/service');

describe('SearchService.buildDateCondition', () => {
    const startOfToday = moment.tz(
        '2026-06-15 00:00:00',
        'YYYY-MM-DD HH:mm:ss',
        'UTC'
    );

    function range(filterValue, fieldName = 'due_date') {
        const condition = searchService.buildDateCondition(
            filterValue,
            startOfToday.clone(),
            fieldName
        );
        if (!condition) return null;
        const [start, end] = condition[fieldName][Op.between];
        return [start.getTime(), end.getTime()];
    }

    it('treats this_week as the same rolling window as next_week', () => {
        expect(range('this_week')).toEqual(range('next_week'));
        expect(range('this_week', 'defer_until')).toEqual(
            range('next_week', 'defer_until')
        );
    });

    it('keeps the next_week window as today through the end of the seventh day', () => {
        expect(range('next_week')).toEqual([
            startOfToday.clone().toDate().getTime(),
            startOfToday.clone().add(7, 'days').endOf('day').toDate().getTime(),
        ]);
    });

    it('keeps today, tomorrow, and next_month distinct from that window', () => {
        const week = range('next_week');
        expect(range('today')).not.toEqual(week);
        expect(range('tomorrow')).not.toEqual(week);
        expect(range('next_month')).not.toEqual(week);
        expect(range('today')).not.toBeNull();
        expect(range('tomorrow')).not.toBeNull();
        expect(range('next_month')).not.toBeNull();
    });

    it('returns null for an unknown value', () => {
        expect(range('overdue')).toBeNull();
        expect(range('not_a_window')).toBeNull();
        expect(range('')).toBeNull();
        expect(range(null)).toBeNull();
        expect(range(undefined)).toBeNull();
    });
});
