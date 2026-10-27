const totp = require('../../../../modules/mfa/totp');

// RFC 6238 appendix B, SHA-1, 8 digits.
const RFC_SECRET = totp.base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
    it.each([
        [59, '94287082'],
        [1111111109, '07081804'],
        [1111111111, '14050471'],
        [1234567890, '89005924'],
        [2000000000, '69279037'],
        [20000000000, '65353130'],
    ])('matches the RFC 6238 code at %i', (seconds, expected) => {
        expect(totp.codeAt(RFC_SECRET, totp.stepAt(seconds * 1000), 8)).toBe(
            expected
        );
    });

    it('round-trips base32', () => {
        const bytes = Buffer.from('any secret bytes');
        expect(totp.base32Decode(totp.base32Encode(bytes))).toEqual(bytes);
    });

    it('accepts one step of clock drift either way, not two', () => {
        const secret = totp.generateSecret();
        const now = Date.now();
        const step = totp.stepAt(now);
        for (const offset of [-1, 0, 1]) {
            const code = totp.codeAt(secret, step + offset);
            expect(totp.verifyCode(secret, code, { now })).toBe(step + offset);
        }
        expect(
            totp.verifyCode(secret, totp.codeAt(secret, step + 2), { now })
        ).toBeNull();
    });

    it('refuses a step already used', () => {
        const secret = totp.generateSecret();
        const now = Date.now();
        const step = totp.stepAt(now);
        const code = totp.codeAt(secret, step);
        expect(totp.verifyCode(secret, code, { now, afterStep: step })).toBe(
            null
        );
    });

    it('refuses anything that is not six digits', () => {
        const secret = totp.generateSecret();
        expect(totp.verifyCode(secret, '12345')).toBeNull();
        expect(totp.verifyCode(secret, 'abcdef')).toBeNull();
        expect(totp.verifyCode(secret, null)).toBeNull();
    });

    it('builds the URI authenticator apps read', () => {
        const uri = totp.otpauthUri('ABC', {
            issuer: 'Tududi',
            account: 'a@example.com',
        });
        expect(uri).toBe(
            'otpauth://totp/Tududi%3Aa%40example.com?secret=ABC&issuer=Tududi&algorithm=SHA1&digits=6&period=30'
        );
    });
});
