import { Node, Link, File } from './node';
import Stats from './Stats';
import Dirent from './Dirent';
import { TSetTimeout } from './setTimeoutUnref';
import { Writable } from 'stream';
import { constants } from './constants';
import { EventEmitter } from 'events';
import { TDataOut } from './encoding';
import * as misc from './node/types/misc';
import * as opts from './node/types/options';
import { FsCallbackApi, WritevCallback } from './node/types/FsCallbackApi';
import { ToTreeOptions } from './print';
import type { PathLike, symlink } from 'fs';
import type { FsPromisesApi, FsSynchronousApi } from './node/types';
import { Dir } from './Dir';
export interface IError extends Error {
    code?: string;
}
export type TFileId = PathLike | number;
export type TData = TDataOut | ArrayBufferView | DataView;
export type TFlags = string | number;
export type TMode = string | number;
export type TTime = number | string | Date;
export type TCallback<TData> = (error?: IError | null, data?: TData) => void;
export type TFlagsCopy = typeof constants.COPYFILE_EXCL | typeof constants.COPYFILE_FICLONE | typeof constants.COPYFILE_FICLONE_FORCE;
export interface IAppendFileOptions extends opts.IFileOptions {
}
export interface IWatchFileOptions {
    persistent?: boolean;
    interval?: number;
}
export interface IWatchOptions extends opts.IOptions {
    persistent?: boolean;
    recursive?: boolean;
}
export declare function filenameToSteps(filename: string, base?: string): string[];
export declare function pathToSteps(path: PathLike): string[];
export declare function dataToStr(data: TData, encoding?: string): string;
export declare function toUnixTimestamp(time: any): any;
type DirectoryContent = string | Buffer | null;
export interface DirectoryJSON<T extends DirectoryContent = DirectoryContent> {
    [key: string]: T;
}
export interface NestedDirectoryJSON<T extends DirectoryContent = DirectoryContent> {
    [key: string]: T | NestedDirectoryJSON;
}
/**
 * `Volume` represents a file system.
 */
export declare class Volume implements FsCallbackApi, FsSynchronousApi {
    static fromJSON(json: DirectoryJSON, cwd?: string): Volume;
    static fromNestedJSON(json: NestedDirectoryJSON, cwd?: string): Volume;
    /**
     * Global file descriptor counter. UNIX file descriptors start from 0 and go sequentially
     * up, so here, in order not to conflict with them, we choose some big number and descrease
     * the file descriptor of every new opened file.
     * @type {number}
     * @todo This should not be static, right?
     */
    static fd: number;
    root: Link;
    ino: number;
    inodes: {
        [ino: number]: Node;
    };
    releasedInos: number[];
    fds: {
        [fd: number]: File;
    };
    releasedFds: number[];
    maxFiles: number;
    openFiles: number;
    StatWatcher: new () => StatWatcher;
    ReadStream: new (...args: any[]) => misc.IReadStream;
    WriteStream: new (...args: any[]) => IWriteStream;
    FSWatcher: new () => FSWatcher;
    props: {
        Node: new (...args: any[]) => Node;
        Link: new (...args: any[]) => Link;
        File: new (...args: any[]) => File;
    };
    private promisesApi;
    get promises(): FsPromisesApi;
    constructor(props?: {});
    createLink(): Link;
    createLink(parent: Link, name: string, isDirectory?: boolean, perm?: number): Link;
    deleteLink(link: Link): boolean;
    private newInoNumber;
    private newFdNumber;
    createNode(isDirectory?: boolean, perm?: number): Node;
    private deleteNode;
    private walk;
    getLink(steps: string[]): Link | null;
    getLinkOrThrow(filename: string, funcName?: string): Link;
    getResolvedLink(filenameOrSteps: string | string[]): Link | null;
    getResolvedLinkOrThrow(filename: string, funcName?: string): Link;
    resolveSymlinks(link: Link): Link | null;
    private getLinkAsDirOrThrow;
    private getLinkParent;
    private getLinkParentAsDirOrThrow;
    private getFileByFd;
    private getFileByFdOrThrow;
    /**
     * @todo This is not used anymore. Remove.
     */
    private wrapAsync;
    private _toJSON;
    toJSON(paths?: PathLike | PathLike[], json?: {}, isRelative?: boolean, asBuffer?: boolean): DirectoryJSON<string | null>;
    fromJSON(json: DirectoryJSON, cwd?: string): void;
    fromNestedJSON(json: NestedDirectoryJSON, cwd?: string): void;
    toTree(opts?: ToTreeOptions): string;
    reset(): void;
    mountSync(mountpoint: string, json: DirectoryJSON): void;
    private openLink;
    private openFile;
    private openBase;
    openSync(path: PathLike, flags: TFlags, mode?: TMode): number;
    open(path: PathLike, flags: TFlags, /* ... */ callback: TCallback<number>): any;
    open(path: PathLike, flags: TFlags, mode: TMode, callback: TCallback<number>): any;
    private closeFile;
    closeSync(fd: number): void;
    close(fd: number, callback: TCallback<void>): void;
    private openFileOrGetById;
    private readBase;
    readSync(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset: number, length: number, position: number | null): number;
    read(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset: number, length: number, position: number | null, callback: (err?: Error | null, bytesRead?: number, buffer?: Buffer | ArrayBufferView | DataView) => void): void;
    private readvBase;
    readv(fd: number, buffers: ArrayBufferView[], callback: misc.TCallback2<number, ArrayBufferView[]>): void;
    readv(fd: number, buffers: ArrayBufferView[], position: number | null, callback: misc.TCallback2<number, ArrayBufferView[]>): void;
    readvSync(fd: number, buffers: ArrayBufferView[], position: number | null): number;
    private readFileBase;
    readFileSync(file: TFileId, options?: opts.IReadFileOptions | string): TDataOut;
    readFile(id: TFileId, callback: TCallback<TDataOut>): any;
    readFile(id: TFileId, options: opts.IReadFileOptions | string, callback: TCallback<TDataOut>): any;
    private writeBase;
    writeSync(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset?: number, length?: number, position?: number): number;
    writeSync(fd: number, str: string, position?: number, encoding?: BufferEncoding): number;
    write(fd: number, buffer: Buffer | ArrayBufferView | DataView, callback: (...args: any[]) => void): any;
    write(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset: number, callback: (...args: any[]) => void): any;
    write(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset: number, length: number, callback: (...args: any[]) => void): any;
    write(fd: number, buffer: Buffer | ArrayBufferView | DataView, offset: number, length: number, position: number, callback: (...args: any[]) => void): any;
    write(fd: number, str: string, callback: (...args: any[]) => void): any;
    write(fd: number, str: string, position: number, callback: (...args: any[]) => void): any;
    write(fd: number, str: string, position: number, encoding: BufferEncoding, callback: (...args: any[]) => void): any;
    private writevBase;
    writev(fd: number, buffers: ArrayBufferView[], callback: WritevCallback): void;
    writev(fd: number, buffers: ArrayBufferView[], position: number | null, callback: WritevCallback): void;
    writevSync(fd: number, buffers: ArrayBufferView[], position: number | null): number;
    private writeFileBase;
    writeFileSync(id: TFileId, data: TData, options?: opts.IWriteFileOptions): void;
    writeFile(id: TFileId, data: TData, callback: TCallback<void>): any;
    writeFile(id: TFileId, data: TData, options: opts.IWriteFileOptions | string, callback: TCallback<void>): any;
    private linkBase;
    private copyFileBase;
    copyFileSync(src: PathLike, dest: PathLike, flags?: TFlagsCopy): void;
    copyFile(src: PathLike, dest: PathLike, callback: TCallback<void>): any;
    copyFile(src: PathLike, dest: PathLike, flags: TFlagsCopy, callback: TCallback<void>): any;
    linkSync(existingPath: PathLike, newPath: PathLike): void;
    link(existingPath: PathLike, newPath: PathLike, callback: TCallback<void>): void;
    private unlinkBase;
    unlinkSync(path: PathLike): void;
    unlink(path: PathLike, callback: TCallback<void>): void;
    private symlinkBase;
    symlinkSync(target: PathLike, path: PathLike, type?: symlink.Type): void;
    symlink(target: PathLike, path: PathLike, callback: TCallback<void>): any;
    symlink(target: PathLike, path: PathLike, type: symlink.Type, callback: TCallback<void>): any;
    private realpathBase;
    realpathSync(path: PathLike, options?: opts.IRealpathOptions | string): TDataOut;
    realpath(path: PathLike, callback: TCallback<TDataOut>): any;
    realpath(path: PathLike, options: opts.IRealpathOptions | string, callback: TCallback<TDataOut>): any;
    private lstatBase;
    lstatSync(path: PathLike): Stats<number>;
    lstatSync(path: PathLike, options: {
        throwIfNoEntry?: true | undefined;
    }): Stats<number>;
    lstatSync(path: PathLike, options: {
        bigint: false;
        throwIfNoEntry?: true | undefined;
    }): Stats<number>;
    lstatSync(path: PathLike, options: {
        bigint: true;
        throwIfNoEntry?: true | undefined;
    }): Stats<bigint>;
    lstatSync(path: PathLike, options: {
        throwIfNoEntry: false;
    }): Stats<number> | undefined;
    lstatSync(path: PathLike, options: {
        bigint: false;
        throwIfNoEntry: false;
    }): Stats<number> | undefined;
    lstatSync(path: PathLike, options: {
        bigint: true;
        throwIfNoEntry: false;
    }): Stats<bigint> | undefined;
    lstat(path: PathLike, callback: TCallback<Stats>): void;
    lstat(path: PathLike, options: opts.IStatOptions, callback: TCallback<Stats>): void;
    private statBase;
    statSync(path: PathLike): Stats<number>;
    statSync(path: PathLike, options: {
        throwIfNoEntry?: true;
    }): Stats<number>;
    statSync(path: PathLike, options: {
        throwIfNoEntry: false;
    }): Stats<number> | undefined;
    statSync(path: PathLike, options: {
        bigint: false;
        throwIfNoEntry?: true;
    }): Stats<number>;
    statSync(path: PathLike, options: {
        bigint: true;
        throwIfNoEntry?: true;
    }): Stats<bigint>;
    statSync(path: PathLike, options: {
        bigint: false;
        throwIfNoEntry: false;
    }): Stats<number> | undefined;
    statSync(path: PathLike, options: {
        bigint: true;
        throwIfNoEntry: false;
    }): Stats<bigint> | undefined;
    stat(path: PathLike, callback: TCallback<Stats>): void;
    stat(path: PathLike, options: opts.IStatOptions, callback: TCallback<Stats>): void;
    private fstatBase;
    fstatSync(fd: number): Stats<number>;
    fstatSync(fd: number, options: {
        bigint: false;
    }): Stats<number>;
    fstatSync(fd: number, options: {
        bigint: true;
    }): Stats<bigint>;
    fstat(fd: number, callback: TCallback<Stats>): void;
    fstat(fd: number, options: opts.IFStatOptions, callback: TCallback<Stats>): void;
    private renameBase;
    renameSync(oldPath: PathLike, newPath: PathLike): void;
    rename(oldPath: PathLike, newPath: PathLike, callback: TCallback<void>): void;
    private existsBase;
    existsSync(path: PathLike): boolean;
    exists(path: PathLike, callback: (exists: boolean) => void): void;
    private accessBase;
    accessSync(path: PathLike, mode?: number): void;
    access(path: PathLike, callback: TCallback<void>): any;
    access(path: PathLike, mode: number, callback: TCallback<void>): any;
    appendFileSync(id: TFileId, data: TData, options?: IAppendFileOptions | string): void;
    appendFile(id: TFileId, data: TData, callback: TCallback<void>): any;
    appendFile(id: TFileId, data: TData, options: IAppendFileOptions | string, callback: TCallback<void>): any;
    private readdirBase;
    readdirSync(path: PathLike, options?: opts.IReaddirOptions | string): TDataOut[] | Dirent[];
    readdir(path: PathLike, callback: TCallback<TDataOut[] | Dirent[]>): any;
    readdir(path: PathLike, options: opts.IReaddirOptions | string, callback: TCallback<TDataOut[] | Dirent[]>): any;
    private readlinkBase;
    readlinkSync(path: PathLike, options?: opts.IOptions): TDataOut;
    readlink(path: PathLike, callback: TCallback<TDataOut>): any;
    readlink(path: PathLike, options: opts.IOptions, callback: TCallback<TDataOut>): any;
    private fsyncBase;
    fsyncSync(fd: number): void;
    fsync(fd: number, callback: TCallback<void>): void;
    private fdatasyncBase;
    fdatasyncSync(fd: number): void;
    fdatasync(fd: number, callback: TCallback<void>): void;
    private ftruncateBase;
    ftruncateSync(fd: number, len?: number): void;
    ftruncate(fd: number, callback: TCallback<void>): any;
    ftruncate(fd: number, len: number, callback: TCallback<void>): any;
    private truncateBase;
    /**
     * `id` should be a file descriptor or a path. `id` as file descriptor will
     * not be supported soon.
     */
    truncateSync(id: TFileId, len?: number): void;
    truncate(id: TFileId, callback: TCallback<void>): any;
    truncate(id: TFileId, len: number, callback: TCallback<void>): any;
    private futimesBase;
    futimesSync(fd: number, atime: TTime, mtime: TTime): void;
    futimes(fd: number, atime: TTime, mtime: TTime, callback: TCallback<void>): void;
    private utimesBase;
    utimesSync(path: PathLike, atime: TTime, mtime: TTime): void;
    utimes(path: PathLike, atime: TTime, mtime: TTime, callback: TCallback<void>): void;
    private mkdirBase;
    /**
     * Creates directory tree recursively.
     */
    private mkdirpBase;
    mkdirSync(path: PathLike, options: opts.IMkdirOptions & {
        recursive: true;
    }): string | undefined;
    mkdirSync(path: PathLike, options?: TMode | (opts.IMkdirOptions & {
        recursive?: false;
    })): void;
    mkdirSync(path: PathLike, options?: TMode | opts.IMkdirOptions): string | undefined;
    mkdir(path: PathLike, callback: TCallback<void>): any;
    mkdir(path: PathLike, mode: TMode | (opts.IMkdirOptions & {
        recursive?: false;
    }), callback: TCallback<void>): any;
    mkdir(path: PathLike, mode: opts.IMkdirOptions & {
        recursive: true;
    }, callback: TCallback<string>): any;
    mkdir(path: PathLike, mode: TMode | opts.IMkdirOptions, callback: TCallback<string>): any;
    private mkdtempBase;
    mkdtempSync(prefix: string, options?: opts.IOptions): TDataOut;
    mkdtemp(prefix: string, callback: TCallback<string>): any;
    mkdtemp(prefix: string, options: opts.IOptions, callback: TCallback<string>): any;
    private rmdirBase;
    rmdirSync(path: PathLike, options?: opts.IRmdirOptions): void;
    rmdir(path: PathLike, callback: TCallback<void>): any;
    rmdir(path: PathLike, options: opts.IRmdirOptions, callback: TCallback<void>): any;
    private rmBase;
    rmSync(path: PathLike, options?: opts.IRmOptions): void;
    rm(path: PathLike, callback: TCallback<void>): void;
    rm(path: PathLike, options: opts.IRmOptions, callback: TCallback<void>): void;
    private fchmodBase;
    fchmodSync(fd: number, mode: TMode): void;
    fchmod(fd: number, mode: TMode, callback: TCallback<void>): void;
    private chmodBase;
    chmodSync(path: PathLike, mode: TMode): void;
    chmod(path: PathLike, mode: TMode, callback: TCallback<void>): void;
    private lchmodBase;
    lchmodSync(path: PathLike, mode: TMode): void;
    lchmod(path: PathLike, mode: TMode, callback: TCallback<void>): void;
    private fchownBase;
    fchownSync(fd: number, uid: number, gid: number): void;
    fchown(fd: number, uid: number, gid: number, callback: TCallback<void>): void;
    private chownBase;
    chownSync(path: PathLike, uid: number, gid: number): void;
    chown(path: PathLike, uid: number, gid: number, callback: TCallback<void>): void;
    private lchownBase;
    lchownSync(path: PathLike, uid: number, gid: number): void;
    lchown(path: PathLike, uid: number, gid: number, callback: TCallback<void>): void;
    private statWatchers;
    watchFile(path: PathLike, listener: (curr: Stats, prev: Stats) => void): StatWatcher;
    watchFile(path: PathLike, options: IWatchFileOptions, listener: (curr: Stats, prev: Stats) => void): StatWatcher;
    unwatchFile(path: PathLike, listener?: (curr: Stats, prev: Stats) => void): void;
    createReadStream(path: misc.PathLike, options?: opts.IReadStreamOptions | string): misc.IReadStream;
    createWriteStream(path: PathLike, options?: opts.IWriteStreamOptions | string): IWriteStream;
    watch(path: PathLike, options?: IWatchOptions | string, listener?: (eventType: string, filename: string) => void): FSWatcher;
    cpSync: FsSynchronousApi['cpSync'];
    lutimesSync: FsSynchronousApi['lutimesSync'];
    statfsSync: FsSynchronousApi['statfsSync'];
    cp: FsCallbackApi['cp'];
    lutimes: FsCallbackApi['lutimes'];
    statfs: FsCallbackApi['statfs'];
    openAsBlob: FsCallbackApi['openAsBlob'];
    private opendirBase;
    opendirSync(path: PathLike, options?: opts.IOpendirOptions | string): Dir;
    opendir(path: PathLike, callback: TCallback<Dir>): any;
    opendir(path: PathLike, options: opts.IOpendirOptions | string, callback: TCallback<Dir>): any;
}
export declare class StatWatcher extends EventEmitter {
    vol: Volume;
    filename: string;
    interval: number;
    timeoutRef?: any;
    setTimeout: TSetTimeout;
    prev: Stats;
    constructor(vol: Volume);
    private loop;
    private hasChanged;
    private onInterval;
    start(path: string, persistent?: boolean, interval?: number): void;
    stop(): void;
}
export interface IWriteStream extends Writable {
    bytesWritten: number;
    path: string;
    pending: boolean;
    new (path: PathLike, options: opts.IWriteStreamOptions): any;
    open(): any;
    close(): any;
}
export declare class FSWatcher extends EventEmitter {
    _vol: Volume;
    _filename: string;
    _steps: string[];
    _filenameEncoded: TDataOut;
    _recursive: boolean;
    _encoding: BufferEncoding;
    _link: Link;
    _timer: any;
    private _listenerRemovers;
    constructor(vol: Volume);
    private _getName;
    private _onParentChild;
    private _emit;
    private _persist;
    start(path: PathLike, persistent?: boolean, recursive?: boolean, encoding?: BufferEncoding): void;
    close(): void;
}
export {};
