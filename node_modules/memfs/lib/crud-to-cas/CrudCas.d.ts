import { CrudCasBase } from './CrudCasBase';
import type { CrudApi } from '../crud/types';
export interface CrudCasOptions {
    hash: (blob: Uint8Array) => Promise<string>;
}
export declare class CrudCas extends CrudCasBase<string> {
    protected readonly crud: CrudApi;
    protected readonly options: CrudCasOptions;
    constructor(crud: CrudApi, options: CrudCasOptions);
}
