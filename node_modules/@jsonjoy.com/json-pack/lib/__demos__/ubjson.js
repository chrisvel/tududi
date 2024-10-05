"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UbjsonEncoder_1 = require("../ubjson/UbjsonEncoder");
const UbjsonDecoder_1 = require("../ubjson/UbjsonDecoder");
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const encoder = new UbjsonEncoder_1.UbjsonEncoder(new Writer_1.Writer());
const decoder = new UbjsonDecoder_1.UbjsonDecoder();
const pojo = {
    id: 123,
    foo: 'bar',
    tags: ['a', 'b', 'c'],
    binary: new Uint8Array([1, 2, 3]),
};
console.clear();
console.log('--------------------------------------------------');
console.log('Encoding UBJSON:');
const encoded = encoder.encode(pojo);
console.log(encoded);
console.log('--------------------------------------------------');
console.log('Decoding UBJSON:');
const decoded = decoder.read(encoded);
console.log(decoded);
console.log('--------------------------------------------------');
console.log('Binary data:');
const blob = encoder.encode({ binary: new Uint8Array([1, 2, 3]) });
console.log(Buffer.from(blob).toString());
//# sourceMappingURL=ubjson.js.map