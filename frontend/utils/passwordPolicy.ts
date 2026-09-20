// Mirrors PASSWORD_MIN_LENGTH in backend/modules/users/userService.js. The
// server is authoritative; this only lets forms fail fast.
export const PASSWORD_MIN_LENGTH = 8;

// Look-alike characters (l, 1, I, O, 0) are left out so a generated password
// can be read aloud or retyped without mistakes.
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const CHARACTER_CLASSES = [LOWER, UPPER, DIGITS, SYMBOLS];
const ALL_CHARACTERS = CHARACTER_CLASSES.join('');

export const GENERATED_PASSWORD_LENGTH = 16;

// Rejection sampling keeps the result uniform: a plain modulo would favour the
// low values whenever max does not divide 2^32.
const randomInt = (max: number): number => {
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    do {
        crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
};

const pick = (characters: string): string =>
    characters[randomInt(characters.length)];

export const generatePassword = (
    length: number = GENERATED_PASSWORD_LENGTH
): string => {
    const size = Math.max(
        length,
        PASSWORD_MIN_LENGTH,
        CHARACTER_CLASSES.length
    );
    const characters = CHARACTER_CLASSES.map(pick);
    while (characters.length < size) characters.push(pick(ALL_CHARACTERS));

    for (let i = characters.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [characters[i], characters[j]] = [characters[j], characters[i]];
    }
    return characters.join('');
};
