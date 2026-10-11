// Life-to-Day (T-305): client-side identity for offline mutations
// (blueprint 13.5). The uid matches backend/utils/uid.js so the server can
// accept it on create; the idempotency key makes retries and SW replays
// exactly-once. Both are generated per logical operation and travel with
// the request, so a queued replay resends the same values.

const CLIENT_UID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';
const CLIENT_UID_LENGTH = 15;

const randomBelow = (max: number): number => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
};

export const newClientUid = (): string => {
    let uid = '';
    for (let i = 0; i < CLIENT_UID_LENGTH; i++) {
        uid += CLIENT_UID_ALPHABET[randomBelow(CLIENT_UID_ALPHABET.length)];
    }
    return uid;
};

export const newIdempotencyKey = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `ltd-${crypto.randomUUID()}`;
    }
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return `ltd-${Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};
