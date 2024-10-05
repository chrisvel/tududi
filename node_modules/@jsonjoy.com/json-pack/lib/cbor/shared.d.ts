import { CborEncoder } from './CborEncoder';
import { CborDecoder } from './CborDecoder';
import { CborUint8Array } from './types';
export type { CborUint8Array };
export declare const encoder: CborEncoder<import("@jsonjoy.com/util/lib/buffers").IWriter & import("@jsonjoy.com/util/lib/buffers").IWriterGrowable>;
export declare const decoder: CborDecoder<import("@jsonjoy.com/util/lib/buffers").IReader & import("@jsonjoy.com/util/lib/buffers").IReaderResettable>;
export declare const encode: <T>(data: T) => CborUint8Array<T>;
export declare const decode: <T>(blob: CborUint8Array<T>) => T;
