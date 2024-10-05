import type * as opts from './types/options';
import type { IFileHandle, IStats, TData, TDataOut, TMode, TTime } from './types/misc';
import type { FsCallbackApi } from './types';
export declare class FileHandle implements IFileHandle {
    private fs;
    fd: number;
    constructor(fs: FsCallbackApi, fd: number);
    appendFile(data: TData, options?: opts.IAppendFileOptions | string): Promise<void>;
    chmod(mode: TMode): Promise<void>;
    chown(uid: number, gid: number): Promise<void>;
    close(): Promise<void>;
    datasync(): Promise<void>;
    readableWebStream(options?: opts.IReadableWebStreamOptions): ReadableStream;
    read(buffer: Buffer | Uint8Array, offset: number, length: number, position: number): Promise<TFileHandleReadResult>;
    readv(buffers: ArrayBufferView[], position?: number | null | undefined): Promise<TFileHandleReadvResult>;
    readFile(options?: opts.IReadFileOptions | string): Promise<TDataOut>;
    stat(options?: opts.IFStatOptions): Promise<IStats>;
    sync(): Promise<void>;
    truncate(len?: number): Promise<void>;
    utimes(atime: TTime, mtime: TTime): Promise<void>;
    write(buffer: Buffer | Uint8Array, offset?: number, length?: number, position?: number): Promise<TFileHandleWriteResult>;
    writev(buffers: ArrayBufferView[], position?: number | null | undefined): Promise<TFileHandleWritevResult>;
    writeFile(data: TData, options?: opts.IWriteFileOptions): Promise<void>;
}
export interface TFileHandleReadResult {
    bytesRead: number;
    buffer: Buffer | Uint8Array;
}
export interface TFileHandleWriteResult {
    bytesWritten: number;
    buffer: Buffer | Uint8Array;
}
export interface TFileHandleReadvResult {
    bytesRead: number;
    buffers: ArrayBufferView[];
}
export interface TFileHandleWritevResult {
    bytesWritten: number;
    buffers: ArrayBufferView[];
}
