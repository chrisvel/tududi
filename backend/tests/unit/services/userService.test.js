const {
    validateEmail,
    validatePassword,
} = require('../../../services/userService');

describe('userService validation functions', () => {
    describe('validateEmail', () => {
        it('should return true for valid email addresses', () => {
            expect(validateEmail('user@example.com')).toBe(true);
            expect(validateEmail('test.email@domain.co.uk')).toBe(true);
            expect(validateEmail('user+tag@example.org')).toBe(true);
            expect(validateEmail('123@test.com')).toBe(true);
        });

        it('should return false for invalid email addresses', () => {
            expect(validateEmail('invalid-email')).toBe(false);
            expect(validateEmail('user@')).toBe(false);
            expect(validateEmail('@domain.com')).toBe(false);
            expect(validateEmail('user@@domain.com')).toBe(false);
            expect(validateEmail('user@domain')).toBe(false);
            expect(validateEmail('user @domain.com')).toBe(false);
            expect(validateEmail('user@domain.')).toBe(false);
            expect(validateEmail('user@.domain.com')).toBe(false);
            expect(validateEmail('user.@domain.com')).toBe(false);
        });

        it('should return false for empty or undefined email', () => {
            expect(validateEmail('')).toBe(false);
            expect(validateEmail(undefined)).toBe(false);
            expect(validateEmail(null)).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should return true for valid passwords', () => {
            expect(validatePassword('123456')).toBe(true);
            expect(validatePassword('password123')).toBe(true);
            expect(
                validatePassword('very-long-password-with-special-chars!')
            ).toBe(true);
        });

        it('should return false for passwords shorter than 6 characters', () => {
            expect(validatePassword('12345')).toBe(false);
            expect(validatePassword('abc')).toBe(false);
            expect(validatePassword('1')).toBe(false);
        });

        it('should return false for empty or undefined password', () => {
            expect(validatePassword('')).toBe(false);
            expect(validatePassword(undefined)).toBe(false);
            expect(validatePassword(null)).toBe(false);
        });
    });
});
