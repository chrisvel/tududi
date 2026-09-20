import { webcrypto } from 'crypto';
import {
    GENERATED_PASSWORD_LENGTH,
    PASSWORD_MIN_LENGTH,
    generatePassword,
} from '../passwordPolicy';

describe('generatePassword', () => {
    beforeAll(() => {
        if (!(global as any).crypto?.getRandomValues) {
            Object.defineProperty(global, 'crypto', {
                value: webcrypto,
                configurable: true,
            });
        }
    });

    it('uses the default length', () => {
        expect(generatePassword()).toHaveLength(GENERATED_PASSWORD_LENGTH);
    });

    it('never goes below the password policy minimum', () => {
        expect(generatePassword(2)).toHaveLength(PASSWORD_MIN_LENGTH);
    });

    it('honours a longer requested length', () => {
        expect(generatePassword(32)).toHaveLength(32);
    });

    it('always includes lower, upper, digit and symbol characters', () => {
        for (let i = 0; i < 200; i++) {
            const password = generatePassword();
            expect(password).toMatch(/[a-z]/);
            expect(password).toMatch(/[A-Z]/);
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(/[^A-Za-z0-9]/);
        }
    });

    it('leaves out look-alike characters', () => {
        for (let i = 0; i < 200; i++) {
            expect(generatePassword(64)).not.toMatch(/[l1IO0]/);
        }
    });

    it('does not repeat itself', () => {
        const seen = new Set(
            Array.from({ length: 100 }, () => generatePassword())
        );
        expect(seen.size).toBe(100);
    });
});
