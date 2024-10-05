import type { FsPromisesApi } from '../node/types';
import type * as crud from '../crud/types';
export interface NodeCrudOptions {
    readonly fs: FsPromisesApi;
    readonly dir: string;
    readonly separator?: string;
}
export declare class NodeCrud implements crud.CrudApi {
    protected readonly options: NodeCrudOptions;
    protected readonly fs: FsPromisesApi;
    protected readonly dir: string;
    protected readonly separator: string;
    constructor(options: NodeCrudOptions);
    protected checkDir(collection: crud.CrudCollection): Promise<string>;
    readonly put: (collection: crud.CrudCollection, id: string, data: Uint8Array, options?: crud.CrudPutOptions) => Promise<void>;
    readonly get: (collection: crud.CrudCollection, id: string) => Promise<Uint8Array>;
    readonly del: (collection: crud.CrudCollection, id: string, silent?: boolean) => Promise<void>;
    readonly info: (collection: crud.CrudCollection, id?: string) => Promise<crud.CrudResourceInfo>;
    readonly drop: (collection: crud.CrudCollection, silent?: boolean) => Promise<void>;
    readonly scan: (collection: crud.CrudCollection) => AsyncIterableIterator<crud.CrudCollectionEntry>;
    readonly list: (collection: crud.CrudCollection) => Promise<crud.CrudCollectionEntry[]>;
    readonly from: (collection: crud.CrudCollection) => Promise<crud.CrudApi>;
}
