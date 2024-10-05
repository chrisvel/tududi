import { Reader } from '@jsonjoy.com/util/lib/buffers/Reader';
import type { BinaryJsonDecoder, PackValue } from '../types';
export declare class JsonDecoder implements BinaryJsonDecoder {
    reader: Reader;
    read(uint8: Uint8Array): unknown;
    decode(uint8: Uint8Array): unknown;
    readAny(): unknown;
    skipWhitespace(): void;
    readNull(): null;
    readTrue(): true;
    readFalse(): false;
    readBool(): unknown;
    readNum(): number;
    readStr(): string;
    tryReadBin(): Uint8Array | undefined;
    readBin(): Uint8Array;
    readArr(): unknown[];
    readObj(): PackValue | Record<string, unknown> | unknown;
}
