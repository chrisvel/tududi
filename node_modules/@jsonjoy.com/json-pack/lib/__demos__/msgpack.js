"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MsgPackEncoder_1 = require("../msgpack/MsgPackEncoder");
const MsgPackDecoder_1 = require("../msgpack/MsgPackDecoder");
const encoder = new MsgPackEncoder_1.MsgPackEncoder();
const decoder = new MsgPackDecoder_1.MsgPackDecoder();
const pojo = {
    id: 123,
    foo: 'bar',
    tags: ['a', 'b', 'c'],
    nested: {
        a: 1,
        b: 2,
        level2: {
            c: 3,
        },
    },
};
console.clear();
console.log('--------------------------------------------------');
console.log('Encoding MessagePack:');
const encoded = encoder.encode(pojo);
console.log(encoded);
console.log('--------------------------------------------------');
console.log('Retrieving values without parsing:');
decoder.reader.reset(encoded);
const id = decoder.find(['id']).val();
decoder.reader.reset(encoded);
const foo = decoder.find(['foo']).val();
decoder.reader.reset(encoded);
const secondTag = decoder.find(['tags', 1]).val();
decoder.reader.reset(encoded);
const nested = decoder.find(['nested', 'level2', 'c']).val();
console.log('id:', id, 'foo:', foo, 'secondTag:', secondTag, 'nested:', nested);
//# sourceMappingURL=msgpack.js.map