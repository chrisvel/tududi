import { newClientUid, newIdempotencyKey } from '../offlineIdentity';

describe('offline identity', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'crypto'
    );

    afterEach(() => {
        if (cryptoDescriptor) {
            Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
        }
    });

    it('uses randomUUID when available', () => {
        const randomUUID = jest.fn(
            () => '00000000-0000-4000-8000-000000000001'
        );
        const getRandomValues = jest.fn();
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: { randomUUID, getRandomValues },
        });

        expect(newIdempotencyKey()).toBe(
            'ltd-00000000-0000-4000-8000-000000000001'
        );
        expect(randomUUID).toHaveBeenCalledTimes(1);
        expect(getRandomValues).not.toHaveBeenCalled();
    });

    it('uses secure random bytes for keys and UIDs without randomUUID', () => {
        const getRandomValues = jest.fn((array: Uint8Array | Uint32Array) => {
            array.fill(1);
            return array;
        });
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: { getRandomValues },
        });

        expect(newIdempotencyKey()).toBe(`ltd-${'01'.repeat(16)}`);
        expect(newClientUid()).toBe('1'.repeat(15));
        expect(getRandomValues).toHaveBeenCalledTimes(16);
    });

    it('reports unavailable secure randomness for both keys and UIDs', () => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: undefined,
        });

        expect(newIdempotencyKey).toThrow(
            'Secure random number generation is unavailable'
        );
        expect(newClientUid).toThrow(
            'Secure random number generation is unavailable'
        );
    });
});
