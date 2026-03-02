'use strict';

const {
    validateName,
    validateAxisLabel,
    validateQuadrantIndex,
    validatePosition,
} = require('../../../modules/matrices/validation');
const { ValidationError } = require('../../../shared/errors');

describe('Matrix Validation', () => {
    describe('validateName', () => {
        it('should return trimmed name for valid input', () => {
            expect(validateName('  My Matrix  ')).toBe('My Matrix');
        });

        it('should accept a single-character name', () => {
            expect(validateName('A')).toBe('A');
        });

        it('should accept a name at the 255-char limit', () => {
            const longName = 'a'.repeat(255);
            expect(validateName(longName)).toBe(longName);
        });

        it('should throw for empty string', () => {
            expect(() => validateName('')).toThrow(ValidationError);
        });

        it('should throw for whitespace-only string', () => {
            expect(() => validateName('   ')).toThrow(ValidationError);
        });

        it('should throw for null', () => {
            expect(() => validateName(null)).toThrow(ValidationError);
        });

        it('should throw for undefined', () => {
            expect(() => validateName(undefined)).toThrow(ValidationError);
        });

        it('should throw for non-string (number)', () => {
            expect(() => validateName(123)).toThrow(ValidationError);
        });

        it('should throw for name exceeding 255 characters', () => {
            expect(() => validateName('a'.repeat(256))).toThrow(
                ValidationError
            );
        });
    });

    describe('validateAxisLabel', () => {
        it('should accept a valid string label', () => {
            expect(() =>
                validateAxisLabel('Urgent', 'x_axis_label_left')
            ).not.toThrow();
        });

        it('should accept an empty string', () => {
            expect(() =>
                validateAxisLabel('', 'x_axis_label_left')
            ).not.toThrow();
        });

        it('should accept undefined (optional field)', () => {
            expect(() =>
                validateAxisLabel(undefined, 'x_axis_label_left')
            ).not.toThrow();
        });

        it('should accept null (optional field)', () => {
            expect(() =>
                validateAxisLabel(null, 'x_axis_label_left')
            ).not.toThrow();
        });

        it('should accept a label at the 100-char limit', () => {
            expect(() =>
                validateAxisLabel('a'.repeat(100), 'x_axis_label_left')
            ).not.toThrow();
        });

        it('should throw for non-string (number)', () => {
            expect(() =>
                validateAxisLabel(42, 'x_axis_label_left')
            ).toThrow(ValidationError);
        });

        it('should throw for label exceeding 100 characters', () => {
            expect(() =>
                validateAxisLabel('a'.repeat(101), 'x_axis_label_left')
            ).toThrow(ValidationError);
        });

        it('should include field name in error message', () => {
            expect(() =>
                validateAxisLabel(42, 'y_axis_label_top')
            ).toThrow(/y_axis_label_top/);
        });
    });

    describe('validateQuadrantIndex', () => {
        it('should accept 0', () => {
            expect(validateQuadrantIndex(0)).toBe(0);
        });

        it('should accept 1', () => {
            expect(validateQuadrantIndex(1)).toBe(1);
        });

        it('should accept 2', () => {
            expect(validateQuadrantIndex(2)).toBe(2);
        });

        it('should accept 3', () => {
            expect(validateQuadrantIndex(3)).toBe(3);
        });

        it('should throw for negative number', () => {
            expect(() => validateQuadrantIndex(-1)).toThrow(ValidationError);
        });

        it('should throw for 4', () => {
            expect(() => validateQuadrantIndex(4)).toThrow(ValidationError);
        });

        it('should throw for float', () => {
            expect(() => validateQuadrantIndex(1.5)).toThrow(ValidationError);
        });

        it('should throw for string', () => {
            expect(() => validateQuadrantIndex('0')).toThrow(ValidationError);
        });

        it('should throw for null', () => {
            expect(() => validateQuadrantIndex(null)).toThrow(ValidationError);
        });

        it('should throw for undefined', () => {
            expect(() => validateQuadrantIndex(undefined)).toThrow(
                ValidationError
            );
        });
    });

    describe('validatePosition', () => {
        it('should accept 0', () => {
            expect(validatePosition(0)).toBe(0);
        });

        it('should accept a positive integer', () => {
            expect(validatePosition(5)).toBe(5);
        });

        it('should default to 0 for undefined', () => {
            expect(validatePosition(undefined)).toBe(0);
        });

        it('should default to 0 for null', () => {
            expect(validatePosition(null)).toBe(0);
        });

        it('should throw for negative number', () => {
            expect(() => validatePosition(-1)).toThrow(ValidationError);
        });

        it('should throw for float', () => {
            expect(() => validatePosition(1.5)).toThrow(ValidationError);
        });
    });
});
