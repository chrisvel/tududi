export interface IPermissionStatus {
    name: string;
    state: 'granted' | 'denied' | 'prompt';
}
export interface IFileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
    isSameEntry(fileSystemHandle: IFileSystemHandle): boolean;
    queryPermission(fileSystemHandlePermissionDescriptor: FileSystemHandlePermissionDescriptor): IPermissionStatus;
    remove(options?: {
        recursive?: boolean;
    }): Promise<void>;
    requestPermission(fileSystemHandlePermissionDescriptor: FileSystemHandlePermissionDescriptor): IPermissionStatus;
}
export interface FileSystemHandlePermissionDescriptor {
    mode: 'read' | 'readwrite';
}
export interface IFileSystemDirectoryHandle extends IFileSystemHandle {
    keys(): AsyncIterableIterator<string>;
    entries(): AsyncIterableIterator<[string, IFileSystemHandle]>;
    values(): AsyncIterableIterator<IFileSystemHandle>;
    getDirectoryHandle(name: string, options?: GetDirectoryHandleOptions): Promise<IFileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: GetFileHandleOptions): Promise<IFileSystemFileHandle>;
    removeEntry(name: string, options?: RemoveEntryOptions): Promise<void>;
    resolve(possibleDescendant: IFileSystemHandle): Promise<string[] | null>;
}
export interface GetDirectoryHandleOptions {
    /**
     * A boolean value, which defaults to `false`. When set to `true` if the directory
     * is not found, one with the specified name will be created and returned.
     */
    create?: boolean;
}
export interface GetFileHandleOptions {
    /**
     * A Boolean. Default `false`. When set to `true` if the file is not found,
     * one with the specified name will be created and returned.
     */
    create?: boolean;
}
export interface RemoveEntryOptions {
    /**
     * A boolean value, which defaults to `false`. When set to true entries will
     * be removed recursively.
     */
    recursive?: boolean;
}
export interface IFileSystemFileHandle extends IFileSystemHandle {
    getFile(): Promise<File>;
    createSyncAccessHandle: undefined | (() => Promise<IFileSystemSyncAccessHandle>);
    createWritable(options?: CreateWritableOptions): Promise<IFileSystemWritableFileStream>;
}
export interface CreateWritableOptions {
    keepExistingData?: boolean;
}
export interface IFileSystemSyncAccessHandle {
    close(): Promise<void>;
    flush(): Promise<void>;
    getSize(): Promise<number>;
    read(buffer: ArrayBuffer | ArrayBufferView, options?: FileSystemReadWriteOptions): Promise<number>;
    truncate(newSize: number): Promise<void>;
    write(buffer: ArrayBuffer | ArrayBufferView | DataView, options?: FileSystemReadWriteOptions): Promise<number>;
}
export interface FileSystemReadWriteOptions {
    /**
     * A number representing the offset in bytes that the file should be read from.
     */
    at?: number;
}
export interface IFileSystemWritableFileStream extends WritableStream {
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    write(chunk: Data): Promise<void>;
    write(params: FileSystemWritableFileStreamParams): Promise<void>;
}
export interface FileSystemWritableFileStreamParams {
    type: 'write' | 'truncate' | 'seek';
    data?: Data;
    position?: number;
    size?: number;
}
export type Data = ArrayBuffer | ArrayBufferView | Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array | BigUint64Array | BigInt64Array | DataView | Blob | string;
