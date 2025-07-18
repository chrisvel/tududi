const { customAlphabet } = require('nanoid');

function uid() {
    const generate = customAlphabet('0123456789abcdefghijkmnpqrstuvwxyz', 15);
    return generate();
}

module.exports = { uid };
