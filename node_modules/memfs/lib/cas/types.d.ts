import type { CrudResourceInfo } from '../crud/types';
export interface CasApi<Hash> {
    put(blob: Uint8Array): Promise<Hash>;
    get(hash: Hash, options?: CasGetOptions): Promise<Uint8Array>;
    del(hash: Hash, silent?: boolean): Promise<void>;
    info(hash: Hash): Promise<CrudResourceInfo>;
}
export interface CasGetOptions {
    skipVerification?: boolean;
}
