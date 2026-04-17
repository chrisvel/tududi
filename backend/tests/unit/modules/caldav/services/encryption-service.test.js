const {
    encrypt,
    decrypt,
    isEncrypted,
} = require('../../../../../modules/caldav/services/encryption-service');

describe('CalDAV Encryption Service', () => {
    describe('encrypt', () => {
        it('should encrypt text and return JSON string', () => {
            const plaintext = 'my-secret-password';
            const encrypted = encrypt(plaintext);

            expect(typeof encrypted).toBe('string');
            const data = JSON.parse(encrypted);
            expect(data).toHaveProperty('iv');
            expect(data).toHaveProperty('encrypted');
            expect(data).toHaveProperty('authTag');
        });

        it('should produce different encrypted values for same input', () => {
            const plaintext = 'test-password';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should throw error for empty text', () => {
            expect(() => encrypt('')).toThrow('Cannot encrypt empty text');
            expect(() => encrypt(null)).toThrow('Cannot encrypt empty text');
        });
    });

    describe('decrypt', () => {
        it('should decrypt encrypted text correctly', () => {
            const plaintext = 'my-secret-password';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle special characters', () => {
            const plaintext = 'p@ssw0rd!#$%^&*()';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle long text', () => {
            const plaintext = 'a'.repeat(1000);
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should throw error for empty data', () => {
            expect(() => decrypt('')).toThrow('Cannot decrypt empty data');
            expect(() => decrypt(null)).toThrow('Cannot decrypt empty data');
        });

        it('should throw error for invalid format', () => {
            expect(() => decrypt('invalid-json')).toThrow('Decryption failed');
        });

        it('should throw error for tampered data', () => {
            const plaintext = 'test-password';
            const encrypted = encrypt(plaintext);
            const data = JSON.parse(encrypted);
            data.encrypted = data.encrypted.replace(/.$/, 'X');
            const tampered = JSON.stringify(data);

            expect(() => decrypt(tampered)).toThrow(
                'Invalid auth tag or tampered data'
            );
        });
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted data', () => {
            const encrypted = encrypt('test');
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(isEncrypted('plain text')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isEncrypted(null)).toBe(false);
            expect(isEncrypted(undefined)).toBe(false);
            expect(isEncrypted(123)).toBe(false);
            expect(isEncrypted({})).toBe(false);
        });

        it('should return false for invalid JSON', () => {
            expect(isEncrypted('{"incomplete"')).toBe(false);
        });

        it('should return false for JSON without required fields', () => {
            expect(isEncrypted('{"iv":"abc"}')).toBe(false);
        });
    });
});
