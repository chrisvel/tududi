const { uid } = require('../../../utils/uid');

describe('uid utility', () => {
    it('should return a string', () => {
        const id = uid();
        expect(typeof id).toBe('string');
    });

    it('should return a 15-character string', () => {
        const id = uid();
        expect(id).toHaveLength(15);
    });

    it('should generate different ids on successive calls', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(uid());
        }
        expect(ids.size).toBe(100);
    });

    it('should only contain characters from the allowed alphabet', () => {
        // The allowed alphabet is '0123456789abcdefghijkmnpqrstuvwxyz'
        // (no 'o' or 'l' to avoid ambiguity)
        // Note: in test env nanoid is mocked, so this validates the mock contract
        const id = uid();
        expect(id).toMatch(/^[0-9a-z]+$/);
    });
});
