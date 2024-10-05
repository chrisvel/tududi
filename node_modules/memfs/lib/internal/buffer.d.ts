import { Buffer } from 'buffer';
declare const bufferAllocUnsafe: (size: number) => Buffer;
declare const bufferFrom: {
    (arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    (data: ReadonlyArray<any>): Buffer;
    (data: Uint8Array): Buffer;
    (obj: {
        valueOf(): string | object;
    } | {
        [Symbol.toPrimitive](hint: "string"): string;
    }, byteOffset?: number, length?: number): Buffer;
    (str: string, encoding?: string): Buffer;
};
export { Buffer, bufferAllocUnsafe, bufferFrom };
