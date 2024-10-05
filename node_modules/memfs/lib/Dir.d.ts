import { Link } from './node';
import * as opts from './node/types/options';
import type { IDir, IDirent } from './node/types/misc';
/**
 * A directory stream, like `fs.Dir`.
 */
export declare class Dir implements IDir {
    protected readonly link: Link;
    protected options: opts.IOpendirOptions;
    private iteratorInfo;
    constructor(link: Link, options: opts.IOpendirOptions);
    private wrapAsync;
    private isFunction;
    private promisify;
    private closeBase;
    private readBase;
    readonly path: string;
    closeBaseAsync(callback: (err?: Error) => void): void;
    close(): Promise<void>;
    close(callback?: (err?: Error) => void): void;
    closeSync(): void;
    readBaseAsync(callback: (err: Error | null, dir?: IDirent | null) => void): void;
    read(): Promise<IDirent | null>;
    read(callback?: (err: Error | null, dir?: IDirent | null) => void): void;
    readSync(): IDirent | null;
    [Symbol.asyncIterator](): AsyncIterableIterator<IDirent>;
}
