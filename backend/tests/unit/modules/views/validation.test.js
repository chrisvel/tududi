'use strict';

const { ValidationError } = require('../../../../shared/errors');
const {
    validateDue,
    validateDefer,
} = require('../../../../modules/views/validation');

const DATE_FILTERS = [
    'today',
    'tomorrow',
    'this_week',
    'next_week',
    'next_month',
];

describe('view date filters', () => {
    it('accepts the due and defer windows search understands', () => {
        for (const value of DATE_FILTERS) {
            expect(validateDue(value)).toBe(value);
            expect(validateDefer(value)).toBe(value);
        }
    });

    it('clears an empty due or defer filter', () => {
        expect(validateDue(null)).toBeNull();
        expect(validateDue(undefined)).toBeNull();
        expect(validateDue('')).toBeNull();
        expect(validateDefer(null)).toBeNull();
    });

    it('rejects an unknown due or defer value', () => {
        expect(() => validateDue('overdue')).toThrow(ValidationError);
        expect(() => validateDue('overdue')).toThrow('Invalid due date filter');
        expect(() => validateDefer('not_a_window')).toThrow(
            'Invalid defer date filter'
        );
    });
});
