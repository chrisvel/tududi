import type { CasApi, CasGetOptions } from '../cas/types';
import type { CrudApi, CrudResourceInfo } from '../crud/types';
import type { FsLocation } from '../fsa-to-node/types';
export declare class CrudCasBase<Hash> implements CasApi<Hash> {
    protected readonly crud: CrudApi;
    protected readonly hash: (blob: Uint8Array) => Promise<Hash>;
    protected readonly hash2Loc: (hash: Hash) => FsLocation;
    protected readonly hashEqual: (h1: Hash, h2: Hash) => boolean;
    constructor(crud: CrudApi, hash: (blob: Uint8Array) => Promise<Hash>, hash2Loc: (hash: Hash) => FsLocation, hashEqual: (h1: Hash, h2: Hash) => boolean);
    readonly put: (blob: Uint8Array) => Promise<Hash>;
    readonly get: (hash: Hash, options?: CasGetOptions) => Promise<Uint8Array>;
    readonly del: (hash: Hash, silent?: boolean) => Promise<void>;
    readonly info: (hash: Hash) => Promise<CrudResourceInfo>;
}
