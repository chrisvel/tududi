"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JsonEncoder_1 = require("../json/JsonEncoder");
const JsonDecoder_1 = require("../json/JsonDecoder");
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const encoder = new JsonEncoder_1.JsonEncoder(new Writer_1.Writer());
const decoder = new JsonDecoder_1.JsonDecoder();
const pojo = {
    id: 123,
    foo: 'bar',
    tags: ['a', 'b', 'c'],
    binary: new Uint8Array([1, 2, 3]),
};
console.clear();
console.log('--------------------------------------------------');
console.log('Encoding JSON:');
const encoded = encoder.encode(pojo);
console.log(encoded);
console.log('--------------------------------------------------');
console.log('Decoding JSON:');
const decoded = decoder.read(encoded);
console.log(decoded);
console.log('--------------------------------------------------');
console.log('Binary data:');
const blob = encoder.encode({ binary: new Uint8Array([1, 2, 3]) });
console.log(Buffer.from(blob).toString());
//# sourceMappingURL=json.js.map