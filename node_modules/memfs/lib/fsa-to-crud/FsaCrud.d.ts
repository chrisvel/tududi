import type * as crud from '../crud/types';
import type * as fsa from '../fsa/types';
export declare class FsaCrud implements crud.CrudApi {
    protected readonly root: fsa.IFileSystemDirectoryHandle | Promise<fsa.IFileSystemDirectoryHandle>;
    constructor(root: fsa.IFileSystemDirectoryHandle | Promise<fsa.IFileSystemDirectoryHandle>);
    protected getDir(collection: crud.CrudCollection, create: boolean): Promise<[dir: fsa.IFileSystemDirectoryHandle, parent: fsa.IFileSystemDirectoryHandle | undefined]>;
    protected getFile(collection: crud.CrudCollection, id: string): Promise<[dir: fsa.IFileSystemDirectoryHandle, file: fsa.IFileSystemFileHandle]>;
    readonly put: (collection: crud.CrudCollection, id: string, data: Uint8Array, options?: crud.CrudPutOptions) => Promise<void>;
    readonly get: (collection: crud.CrudCollection, id: string) => Promise<Uint8Array>;
    readonly del: (collection: crud.CrudCollection, id: string, silent?: boolean) => Promise<void>;
    readonly info: (collection: crud.CrudCollection, id?: string) => Promise<crud.CrudResourceInfo>;
    readonly drop: (collection: crud.CrudCollection, silent?: boolean) => Promise<void>;
    readonly scan: (collection: crud.CrudCollection) => AsyncIterableIterator<crud.CrudCollectionEntry>;
    readonly list: (collection: crud.CrudCollection) => Promise<crud.CrudCollectionEntry[]>;
    readonly from: (collection: crud.CrudCollection) => Promise<crud.CrudApi>;
}
