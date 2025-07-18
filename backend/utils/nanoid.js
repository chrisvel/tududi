const nanoid = require('nanoid');

function uid() {
    const generate = nanoid.customAlphabet(
        '0123456789abcdefghijkmnpqrstuvwxyz',
        15
    );
    return generate();
}

module.exports = { uid };
