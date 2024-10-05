"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CborEncoder_1 = require("../cbor/CborEncoder");
const CborDecoder_1 = require("../cbor/CborDecoder");
const CborDecoderBase_1 = require("../cbor/CborDecoderBase");
const encoder = new CborEncoder_1.CborEncoder();
const decoder = new CborDecoder_1.CborDecoder();
const decoderBase = new CborDecoderBase_1.CborDecoderBase();
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
console.log('Encoding CBOR:');
const encoded = encoder.encode(pojo);
console.log(encoded);
console.log('--------------------------------------------------');
console.log('Decoding CBOR:');
const decoded = decoderBase.read(encoded);
console.log(decoded);
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
console.log('--------------------------------------------------');
console.log('Asserting by value type:');
decoder.reader.reset(encoded);
const tagAsString = decoder.find(['tags', 1]).readPrimitiveOrVal();
console.log({ tagAsString });
console.log('--------------------------------------------------');
console.log('Parsing only one level:');
const decodedLevel = decoder.decodeLevel(encoded);
console.log(decodedLevel);
//# sourceMappingURL=cbor.js.map