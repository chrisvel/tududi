// Mock implementation of nanoid for testing
// This provides a consistent, deterministic nanoid for tests

let counter = 0;

function nanoid(size = 21) {
    // Generate a deterministic ID for testing
    const prefix = 'test';
    const suffix = counter.toString().padStart(4, '0');
    counter++;

    // Make it the requested size by padding or truncating
    const id = (prefix + suffix)
        .repeat(Math.ceil(size / (prefix + suffix).length))
        .substring(0, size);
    return id;
}

function customAlphabet(alphabet, defaultSize = 21) {
    return (size = defaultSize) => {
        return nanoid(size);
    };
}

module.exports = {
    nanoid,
    customAlphabet,
};
