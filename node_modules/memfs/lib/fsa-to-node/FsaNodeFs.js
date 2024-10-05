"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsaNodeFs = void 0;
const tslib_1 = require("tslib");
const optHelpers = require("../node/options");
const util = require("../node/util");
const buffer_1 = require("../internal/buffer");
const FsPromises_1 = require("../node/FsPromises");
const util_1 = require("./util");
const constants_1 = require("../node/constants");
const encoding_1 = require("../encoding");
const FsaNodeDirent_1 = require("./FsaNodeDirent");
const constants_2 = require("../constants");
const FsaNodeStats_1 = require("./FsaNodeStats");
const queueMicrotask_1 = require("../queueMicrotask");
const FsaNodeWriteStream_1 = require("./FsaNodeWriteStream");
const FsaNodeReadStream_1 = require("./FsaNodeReadStream");
const FsaNodeCore_1 = require("./FsaNodeCore");
const FileHandle_1 = require("../node/FileHandle");
const notSupported = () => {
    throw new Error('Method not supported by the File System Access API.');
};
const notImplemented = () => {
    throw new Error('Not implemented');
};
const noop = () => { };
/**
 * Constructs a Node.js `fs` API from a File System Access API
 * [`FileSystemDirectoryHandle` object](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle).
 */
class FsaNodeFs extends FsaNodeCore_1.FsaNodeCore {
    constructor() {
        // ------------------------------------------------------------ FsPromisesApi
        super(...arguments);
        this.promises = new FsPromises_1.FsPromises(this, FileHandle_1.FileHandle);
        // ------------------------------------------------------------ FsCallbackApi
        this.open = (path, flags, a, b) => {
            let mode = a;
            let callback = b;
            if (typeof a === 'function') {
                mode = 438 /* MODE.DEFAULT */;
                callback = a;
            }
            mode = mode || 438 /* MODE.DEFAULT */;
            const modeNum = util.modeToNumber(mode);
            const filename = util.pathToFilename(path);
            const flagsNum = util.flagsToNumber(flags);
            this.__open(filename, flagsNum, modeNum).then(openFile => callback(null, openFile.fd), error => callback(error));
        };
        this.close = (fd, callback) => {
            util.validateFd(fd);
            this.__close(fd).then(() => callback(null), error => callback(error));
        };
        this.read = (fd, buffer, offset, length, position, callback) => {
            util.validateCallback(callback);
            // This `if` branch is from Node.js
            if (length === 0) {
                return (0, queueMicrotask_1.default)(() => {
                    if (callback)
                        callback(null, 0, buffer);
                });
            }
            (async () => {
                const openFile = await this.getFileByFd(fd, 'read');
                const file = await openFile.file.getFile();
                const src = await file.arrayBuffer();
                const slice = new Uint8Array(src, Number(position), Number(length));
                const dest = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, slice.length);
                dest.set(slice, 0);
                return slice.length;
            })().then(bytesWritten => callback(null, bytesWritten, buffer), error => callback(error));
        };
        this.readFile = (id, a, b) => {
            const [opts, callback] = optHelpers.optsAndCbGenerator(optHelpers.getReadFileOptions)(a, b);
            const flagsNum = util.flagsToNumber(opts.flag);
            (async () => {
                let fd = typeof id === 'number' ? id : -1;
                const originalFd = fd;
                try {
                    if (fd === -1) {
                        const filename = util.pathToFilename(id);
                        fd = (await this.__open(filename, flagsNum, 0)).fd;
                    }
                    const handle = await this.__getFileById(fd, 'readFile');
                    const file = await handle.getFile();
                    const buffer = buffer_1.Buffer.from(await file.arrayBuffer());
                    return util.bufferToEncoding(buffer, opts.encoding);
                }
                finally {
                    try {
                        const idWasFd = typeof originalFd === 'number' && originalFd >= 0;
                        if (idWasFd)
                            await this.__close(originalFd);
                    }
                    catch (_a) { }
                }
            })()
                .then(data => callback(null, data))
                .catch(error => callback(error));
        };
        this.write = (fd, a, b, c, d, e) => {
            const [, asStr, buf, offset, length, position, cb] = util.getWriteArgs(fd, a, b, c, d, e);
            (async () => {
                const openFile = await this.getFileByFd(fd, 'write');
                const data = buf.subarray(offset, offset + length);
                await openFile.write(data, position);
                return length;
            })().then(bytesWritten => cb(null, bytesWritten, asStr ? a : buf), error => cb(error));
        };
        this.writev = (fd, buffers, a, b) => {
            util.validateFd(fd);
            let position = null;
            let callback;
            if (typeof a === 'function') {
                callback = a;
            }
            else {
                position = Number(a);
                callback = b;
            }
            util.validateCallback(callback);
            (async () => {
                const openFile = await this.getFileByFd(fd, 'writev');
                const length = buffers.length;
                let bytesWritten = 0;
                for (let i = 0; i < length; i++) {
                    const data = buffers[i];
                    await openFile.write(data, position);
                    bytesWritten += data.byteLength;
                    position = null;
                }
                return bytesWritten;
            })().then(bytesWritten => callback(null, bytesWritten, buffers), error => callback(error));
        };
        this.writeFile = (id, data, a, b) => {
            let options = a;
            let callback = b;
            if (typeof a === 'function') {
                options = optHelpers.writeFileDefaults;
                callback = a;
            }
            const cb = util.validateCallback(callback);
            const opts = optHelpers.getWriteFileOptions(options);
            const flagsNum = util.flagsToNumber(opts.flag);
            const modeNum = util.modeToNumber(opts.mode);
            const buf = util.dataToBuffer(data, opts.encoding);
            (async () => {
                let fd = typeof id === 'number' ? id : -1;
                const originalFd = fd;
                try {
                    if (fd === -1) {
                        const filename = util.pathToFilename(id);
                        fd = (await this.__open(filename, flagsNum, modeNum)).fd;
                    }
                    const file = await this.__getFileById(fd, 'writeFile');
                    const writable = await file.createWritable({ keepExistingData: false });
                    await writable.write(buf);
                    await writable.close();
                }
                finally {
                    try {
                        const idWasFd = typeof originalFd === 'number' && originalFd >= 0;
                        if (idWasFd)
                            await this.__close(originalFd);
                    }
                    catch (_a) { }
                }
            })().then(() => cb(null), error => cb(error));
        };
        this.copyFile = (src, dest, a, b) => {
            const srcFilename = util.pathToFilename(src);
            const destFilename = util.pathToFilename(dest);
            let flags;
            let callback;
            if (typeof a === 'function') {
                flags = 0;
                callback = a;
            }
            else {
                flags = a;
                callback = b;
            }
            util.validateCallback(callback);
            const [oldFolder, oldName] = (0, util_1.pathToLocation)(srcFilename);
            const [newFolder, newName] = (0, util_1.pathToLocation)(destFilename);
            (async () => {
                const oldFile = await this.getFile(oldFolder, oldName, 'copyFile');
                const newDir = await this.getDir(newFolder, false, 'copyFile');
                const newFile = await newDir.getFileHandle(newName, { create: true });
                const writable = await newFile.createWritable({ keepExistingData: false });
                const oldData = await oldFile.getFile();
                await writable.write(await oldData.arrayBuffer());
                await writable.close();
            })().then(() => callback(null), error => callback(error));
        };
        /**
         * @todo There is a proposal for native "self remove" operation.
         * @see https://github.com/whatwg/fs/blob/main/proposals/Remove.md
         */
        this.unlink = (path, callback) => {
            const filename = util.pathToFilename(path);
            const [folder, name] = (0, util_1.pathToLocation)(filename);
            this.getDir(folder, false, 'unlink')
                .then(dir => dir.removeEntry(name))
                .then(() => callback(null), error => {
                if (error && typeof error === 'object') {
                    switch (error.name) {
                        case 'NotFoundError': {
                            callback(util.createError('ENOENT', 'unlink', filename));
                            return;
                        }
                        case 'InvalidModificationError': {
                            callback(util.createError('EISDIR', 'unlink', filename));
                            return;
                        }
                    }
                }
                callback(error);
            });
        };
        this.realpath = (path, a, b) => {
            const [opts, callback] = optHelpers.getRealpathOptsAndCb(a, b);
            let pathFilename = util.pathToFilename(path);
            if (pathFilename[0] !== "/" /* FsaToNodeConstants.Separator */)
                pathFilename = "/" /* FsaToNodeConstants.Separator */ + pathFilename;
            callback(null, (0, encoding_1.strToEncoding)(pathFilename, opts.encoding));
        };
        this.stat = (path, a, b) => {
            const [{ bigint = false, throwIfNoEntry = true }, callback] = optHelpers.getStatOptsAndCb(a, b);
            const filename = util.pathToFilename(path);
            const [folder, name] = (0, util_1.pathToLocation)(filename);
            (async () => {
                const handle = await this.getFileOrDir(folder, name, 'stat');
                return await this.getHandleStats(bigint, handle);
            })().then(stats => callback(null, stats), error => callback(error));
        };
        this.lstat = this.stat;
        this.fstat = (fd, a, b) => {
            const [{ bigint = false, throwIfNoEntry = true }, callback] = optHelpers.getStatOptsAndCb(a, b);
            (async () => {
                const openFile = await this.getFileByFd(fd, 'fstat');
                return await this.getHandleStats(bigint, openFile.file);
            })().then(stats => callback(null, stats), error => callback(error));
        };
        /**
         * @todo There is a proposal for native move support.
         * @see https://github.com/whatwg/fs/blob/main/proposals/MovingNonOpfsFiles.md
         */
        this.rename = (oldPath, newPath, callback) => {
            const oldPathFilename = util.pathToFilename(oldPath);
            const newPathFilename = util.pathToFilename(newPath);
            const [oldFolder, oldName] = (0, util_1.pathToLocation)(oldPathFilename);
            const [newFolder, newName] = (0, util_1.pathToLocation)(newPathFilename);
            (async () => {
                const oldFile = await this.getFile(oldFolder, oldName, 'rename');
                const newDir = await this.getDir(newFolder, false, 'rename');
                const newFile = await newDir.getFileHandle(newName, { create: true });
                const writable = await newFile.createWritable({ keepExistingData: false });
                const oldData = await oldFile.getFile();
                await writable.write(await oldData.arrayBuffer());
                await writable.close();
                const oldDir = await this.getDir(oldFolder, false, 'rename');
                await oldDir.removeEntry(oldName);
            })().then(() => callback(null), error => callback(error));
        };
        this.exists = (path, callback) => {
            const filename = util.pathToFilename(path);
            if (typeof callback !== 'function')
                throw Error(constants_1.ERRSTR.CB);
            this.access(path, 0 /* AMODE.F_OK */, error => callback(!error));
        };
        this.access = (path, a, b) => {
            let mode = 0 /* AMODE.F_OK */;
            let callback;
            if (typeof a !== 'function') {
                mode = a | 0; // cast to number
                callback = util.validateCallback(b);
            }
            else {
                callback = a;
            }
            const filename = util.pathToFilename(path);
            const [folder, name] = (0, util_1.pathToLocation)(filename);
            (async () => {
                const node = folder.length || name ? await this.getFileOrDir(folder, name, 'access') : await this.root;
                const checkIfCanExecute = mode & 1 /* AMODE.X_OK */;
                if (checkIfCanExecute)
                    throw util.createError('EACCESS', 'access', filename);
                const checkIfCanWrite = mode & 2 /* AMODE.W_OK */;
                switch (node.kind) {
                    case 'file': {
                        if (checkIfCanWrite) {
                            try {
                                const file = node;
                                const writable = await file.createWritable();
                                await writable.close();
                            }
                            catch (_a) {
                                throw util.createError('EACCESS', 'access', filename);
                            }
                        }
                        break;
                    }
                    case 'directory': {
                        if (checkIfCanWrite) {
                            const dir = node;
                            const canWrite = await (0, util_1.testDirectoryIsWritable)(dir);
                            if (!canWrite)
                                throw util.createError('EACCESS', 'access', filename);
                        }
                        break;
                    }
                    default: {
                        throw util.createError('EACCESS', 'access', filename);
                    }
                }
            })().then(() => callback(null), error => callback(error));
        };
        this.appendFile = (id, data, a, b) => {
            const [opts, callback] = optHelpers.getAppendFileOptsAndCb(a, b);
            const buffer = util.dataToBuffer(data, opts.encoding);
            this.getFileByIdOrCreate(id, 'appendFile')
                .then(file => (async () => {
                const blob = await file.getFile();
                const writable = await file.createWritable({ keepExistingData: true });
                await writable.write({
                    type: 'write',
                    data: buffer,
                    position: blob.size,
                });
                await writable.close();
            })())
                .then(() => callback(null), error => callback(error));
        };
        this.readdir = (path, a, b) => {
            const [options, callback] = optHelpers.getReaddirOptsAndCb(a, b);
            const filename = util.pathToFilename(path);
            const [folder, name] = (0, util_1.pathToLocation)(filename);
            if (name)
                folder.push(name);
            this.getDir(folder, false, 'readdir')
                .then(dir => (async () => {
                var _a, e_1, _b, _c, _d, e_2, _e, _f;
                if (options.withFileTypes) {
                    const list = [];
                    try {
                        for (var _g = true, _h = tslib_1.__asyncValues(dir.entries()), _j; _j = await _h.next(), _a = _j.done, !_a; _g = true) {
                            _c = _j.value;
                            _g = false;
                            const [name, handle] = _c;
                            const dirent = new FsaNodeDirent_1.FsaNodeDirent(name, handle.kind);
                            list.push(dirent);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_g && !_a && (_b = _h.return)) await _b.call(_h);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    if (!util.isWin && options.encoding !== 'buffer')
                        list.sort((a, b) => {
                            if (a.name < b.name)
                                return -1;
                            if (a.name > b.name)
                                return 1;
                            return 0;
                        });
                    return list;
                }
                else {
                    const list = [];
                    try {
                        for (var _k = true, _l = tslib_1.__asyncValues(dir.keys()), _m; _m = await _l.next(), _d = _m.done, !_d; _k = true) {
                            _f = _m.value;
                            _k = false;
                            const key = _f;
                            list.push(key);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (!_k && !_d && (_e = _l.return)) await _e.call(_l);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    if (!util.isWin && options.encoding !== 'buffer')
                        list.sort();
                    return list;
                }
            })())
                .then(res => callback(null, res), err => callback(err));
        };
        this.readlink = (path, a, b) => {
            const [opts, callback] = optHelpers.getDefaultOptsAndCb(a, b);
            const filename = util.pathToFilename(path);
            const buffer = buffer_1.Buffer.from(filename);
            callback(null, util.bufferToEncoding(buffer, opts.encoding));
        };
        /** @todo Could this use `FileSystemSyncAccessHandle.flush` through a Worker thread? */
        this.fsync = (fd, callback) => {
            callback(null);
        };
        this.fdatasync = (fd, callback) => {
            callback(null);
        };
        this.ftruncate = (fd, a, b) => {
            const len = typeof a === 'number' ? a : 0;
            const callback = util.validateCallback(typeof a === 'number' ? b : a);
            this.getFileByFdAsync(fd)
                .then(file => file.file.createWritable({ keepExistingData: true }))
                .then(writable => writable.truncate(len).then(() => writable.close()))
                .then(() => callback(null), error => callback(error));
        };
        this.truncate = (path, a, b) => {
            const len = typeof a === 'number' ? a : 0;
            const callback = util.validateCallback(typeof a === 'number' ? b : a);
            this.open(path, 'r+', (error, fd) => {
                if (error)
                    callback(error);
                else {
                    this.ftruncate(fd, len, error => {
                        if (error)
                            this.close(fd, () => callback(error));
                        else
                            this.close(fd, callback);
                    });
                }
            });
        };
        this.futimes = (fd, atime, mtime, callback) => {
            callback(null);
        };
        this.utimes = (path, atime, mtime, callback) => {
            callback(null);
        };
        this.mkdir = (path, a, b) => {
            var _a;
            const opts = optHelpers.getMkdirOptions(a);
            const callback = util.validateCallback(typeof a === 'function' ? a : b);
            // const modeNum = modeToNumber(opts.mode, 0o777);
            const filename = util.pathToFilename(path);
            const [folder, name] = (0, util_1.pathToLocation)(filename);
            // TODO: need to throw if directory already exists
            this.getDir(folder, (_a = opts.recursive) !== null && _a !== void 0 ? _a : false)
                .then(dir => dir.getDirectoryHandle(name, { create: true }))
                .then(() => callback(null), error => {
                if (error && typeof error === 'object') {
                    switch (error.name) {
                        case 'NotFoundError': {
                            const err = util.createError('ENOENT', 'mkdir', folder.join('/'));
                            callback(err);
                            return;
                        }
                    }
                }
                callback(error);
            });
        };
        this.mkdtemp = (prefix, a, b) => {
            const [{ encoding }, callback] = optHelpers.getDefaultOptsAndCb(a, b);
            if (!prefix || typeof prefix !== 'string')
                throw new TypeError('filename prefix is required');
            if (!util.nullCheck(prefix))
                return;
            const filename = prefix + util.genRndStr6();
            this.mkdir(filename, 511 /* MODE.DIR */, err => {
                if (err)
                    callback(err);
                else
                    callback(null, (0, encoding_1.strToEncoding)(filename, encoding));
            });
        };
        this.rmdir = (path, a, b) => {
            const options = optHelpers.getRmdirOptions(a);
            const callback = util.validateCallback(typeof a === 'function' ? a : b);
            const [folder, name] = (0, util_1.pathToLocation)(util.pathToFilename(path));
            if (!name && options.recursive)
                return this.rmAll(callback);
            this.getDir(folder, false, 'rmdir')
                .then(dir => dir.getDirectoryHandle(name).then(() => dir))
                .then(dir => { var _a; return dir.removeEntry(name, { recursive: (_a = options.recursive) !== null && _a !== void 0 ? _a : false }); })
                .then(() => callback(null), error => {
                if (error && typeof error === 'object') {
                    switch (error.name) {
                        case 'NotFoundError': {
                            const err = util.createError('ENOENT', 'rmdir', folder.join('/'));
                            callback(err);
                            return;
                        }
                        case 'InvalidModificationError': {
                            const err = util.createError('ENOTEMPTY', 'rmdir', folder.join('/'));
                            callback(err);
                            return;
                        }
                    }
                }
                callback(error);
            });
        };
        this.rm = (path, a, b) => {
            const [options, callback] = optHelpers.getRmOptsAndCb(a, b);
            const [folder, name] = (0, util_1.pathToLocation)(util.pathToFilename(path));
            if (!name && options.recursive)
                return this.rmAll(callback);
            this.getDir(folder, false, 'rmdir')
                .then(dir => { var _a; return dir.removeEntry(name, { recursive: (_a = options.recursive) !== null && _a !== void 0 ? _a : false }); })
                .then(() => callback(null), error => {
                if (options.force) {
                    callback(null);
                    return;
                }
                if (error && typeof error === 'object') {
                    switch (error.name) {
                        case 'NotFoundError': {
                            const err = util.createError('ENOENT', 'rmdir', folder.join('/'));
                            callback(err);
                            return;
                        }
                        case 'InvalidModificationError': {
                            const err = util.createError('ENOTEMPTY', 'rmdir', folder.join('/'));
                            callback(err);
                            return;
                        }
                    }
                }
                callback(error);
            });
        };
        this.fchmod = (fd, mode, callback) => {
            callback(null);
        };
        this.chmod = (path, mode, callback) => {
            callback(null);
        };
        this.lchmod = (path, mode, callback) => {
            callback(null);
        };
        this.fchown = (fd, uid, gid, callback) => {
            callback(null);
        };
        this.chown = (path, uid, gid, callback) => {
            callback(null);
        };
        this.lchown = (path, uid, gid, callback) => {
            callback(null);
        };
        this.createWriteStream = (path, options) => {
            var _a;
            const defaults = {
                encoding: 'utf8',
                flags: 'w',
                autoClose: true,
                emitClose: true,
            };
            const optionsObj = optHelpers.getOptions(defaults, options);
            const filename = util.pathToFilename(path);
            const flags = util.flagsToNumber((_a = optionsObj.flags) !== null && _a !== void 0 ? _a : 'w');
            const fd = optionsObj.fd ? (typeof optionsObj.fd === 'number' ? optionsObj.fd : optionsObj.fd.fd) : 0;
            const handle = fd ? this.getFileByFdAsync(fd) : this.__open(filename, flags, 0);
            const stream = new FsaNodeWriteStream_1.FsaNodeWriteStream(handle, filename, optionsObj);
            if (optionsObj.autoClose) {
                stream.once('finish', () => {
                    handle.then(file => this.close(file.fd, () => { }));
                });
                stream.once('error', () => {
                    handle.then(file => this.close(file.fd, () => { }));
                });
            }
            return stream;
        };
        this.createReadStream = (path, options) => {
            const defaults = {
                flags: 'r',
                fd: null,
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0,
                end: Infinity,
                highWaterMark: 64 * 1024,
                fs: null,
                signal: null,
            };
            const optionsObj = optHelpers.getOptions(defaults, options);
            const filename = util.pathToFilename(path);
            const flags = util.flagsToNumber(optionsObj.flags);
            const fd = optionsObj.fd ? (typeof optionsObj.fd === 'number' ? optionsObj.fd : optionsObj.fd.fd) : 0;
            const handle = fd ? this.getFileByFdAsync(fd) : this.__open(filename, flags, 0);
            const stream = new FsaNodeReadStream_1.FsaNodeReadStream(this, handle, filename, optionsObj);
            return stream;
        };
        this.cp = notImplemented;
        this.lutimes = notImplemented;
        this.openAsBlob = notImplemented;
        this.opendir = notImplemented;
        this.readv = notImplemented;
        this.statfs = notImplemented;
        /**
         * @todo Watchers could be implemented in the future on top of `FileSystemObserver`,
         * which is currently a proposal.
         * @see https://github.com/whatwg/fs/blob/main/proposals/FileSystemObserver.md
         */
        this.watchFile = notSupported;
        this.unwatchFile = notSupported;
        this.watch = notSupported;
        this.symlink = notSupported;
        this.link = notSupported;
        // --------------------------------------------------------- FsSynchronousApi
        this.statSync = (path, options) => {
            var _a;
            const { bigint = true, throwIfNoEntry = true } = optHelpers.getStatOptions(options);
            const filename = util.pathToFilename(path);
            const location = (0, util_1.pathToLocation)(filename);
            const adapter = this.getSyncAdapter();
            const res = adapter.call('stat', location);
            const stats = new FsaNodeStats_1.FsaNodeStats(bigint, (_a = res.size) !== null && _a !== void 0 ? _a : 0, res.kind);
            return stats;
        };
        this.lstatSync = this.statSync;
        this.fstatSync = (fd, options) => {
            const filename = this.getFileName(fd);
            return this.statSync(filename, options);
        };
        this.accessSync = (path, mode = 0 /* AMODE.F_OK */) => {
            const filename = util.pathToFilename(path);
            mode = mode | 0;
            const adapter = this.getSyncAdapter();
            adapter.call('access', [filename, mode]);
        };
        this.readFileSync = (id, options) => {
            const opts = optHelpers.getReadFileOptions(options);
            const flagsNum = util.flagsToNumber(opts.flag);
            const filename = this.getFileName(id);
            const adapter = this.getSyncAdapter();
            const uint8 = adapter.call('readFile', [filename, opts]);
            const buffer = buffer_1.Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength);
            return util.bufferToEncoding(buffer, opts.encoding);
        };
        this.writeFileSync = (id, data, options) => {
            const opts = optHelpers.getWriteFileOptions(options);
            const flagsNum = util.flagsToNumber(opts.flag);
            const modeNum = util.modeToNumber(opts.mode);
            const buf = util.dataToBuffer(data, opts.encoding);
            const filename = this.getFileName(id);
            const adapter = this.getSyncAdapter();
            adapter.call('writeFile', [filename, util.bufToUint8(buf), opts]);
        };
        this.appendFileSync = (id, data, options) => {
            const opts = optHelpers.getAppendFileOpts(options);
            if (!opts.flag || util.isFd(id))
                opts.flag = 'a';
            const filename = this.getFileName(id);
            const buf = util.dataToBuffer(data, opts.encoding);
            const adapter = this.getSyncAdapter();
            adapter.call('appendFile', [filename, util.bufToUint8(buf), opts]);
        };
        this.closeSync = (fd) => {
            util.validateFd(fd);
            const file = this.getFileByFd(fd, 'close');
            file.close().catch(() => { });
            this.fds.delete(fd);
            this.releasedFds.push(fd);
        };
        this.existsSync = (path) => {
            try {
                this.statSync(path);
                return true;
            }
            catch (_a) {
                return false;
            }
        };
        this.copyFileSync = (src, dest, flags) => {
            const srcFilename = util.pathToFilename(src);
            const destFilename = util.pathToFilename(dest);
            const adapter = this.getSyncAdapter();
            adapter.call('copy', [srcFilename, destFilename, flags]);
        };
        this.renameSync = (oldPath, newPath) => {
            const srcFilename = util.pathToFilename(oldPath);
            const destFilename = util.pathToFilename(newPath);
            const adapter = this.getSyncAdapter();
            adapter.call('move', [srcFilename, destFilename]);
        };
        this.rmdirSync = (path, opts) => {
            const filename = util.pathToFilename(path);
            const adapter = this.getSyncAdapter();
            adapter.call('rmdir', [filename, opts]);
        };
        this.rmSync = (path, options) => {
            const filename = util.pathToFilename(path);
            const adapter = this.getSyncAdapter();
            adapter.call('rm', [filename, options]);
        };
        this.mkdirSync = (path, options) => {
            const opts = optHelpers.getMkdirOptions(options);
            const modeNum = util.modeToNumber(opts.mode, 0o777);
            const filename = util.pathToFilename(path);
            return this.getSyncAdapter().call('mkdir', [filename, options]);
        };
        this.mkdtempSync = (prefix, options) => {
            const { encoding } = optHelpers.getDefaultOpts(options);
            if (!prefix || typeof prefix !== 'string')
                throw new TypeError('filename prefix is required');
            util.nullCheck(prefix);
            const result = this.getSyncAdapter().call('mkdtemp', [prefix, options]);
            return (0, encoding_1.strToEncoding)(result, encoding);
        };
        this.readlinkSync = (path, options) => {
            const opts = optHelpers.getDefaultOpts(options);
            const filename = util.pathToFilename(path);
            const buffer = buffer_1.Buffer.from(filename);
            return util.bufferToEncoding(buffer, opts.encoding);
        };
        this.truncateSync = (id, len) => {
            if (util.isFd(id))
                return this.ftruncateSync(id, len);
            const filename = util.pathToFilename(id);
            this.getSyncAdapter().call('trunc', [filename, Number(len) || 0]);
        };
        this.ftruncateSync = (fd, len) => {
            const filename = this.getFileName(fd);
            this.truncateSync(filename, len);
        };
        this.unlinkSync = (path) => {
            const filename = util.pathToFilename(path);
            this.getSyncAdapter().call('unlink', [filename]);
        };
        this.readdirSync = (path, options) => {
            const opts = optHelpers.getReaddirOptions(options);
            const filename = util.pathToFilename(path);
            const adapter = this.getSyncAdapter();
            const list = adapter.call('readdir', [filename]);
            if (opts.withFileTypes) {
                const res = [];
                for (const entry of list)
                    res.push(new FsaNodeDirent_1.FsaNodeDirent(entry.name, entry.kind));
                return res;
            }
            else {
                const res = [];
                for (const entry of list) {
                    const buffer = buffer_1.Buffer.from(entry.name);
                    res.push(util.bufferToEncoding(buffer, opts.encoding));
                }
                return res;
            }
        };
        this.realpathSync = (path, options) => {
            let filename = util.pathToFilename(path);
            const { encoding } = optHelpers.getRealpathOptions(options);
            if (filename[0] !== "/" /* FsaToNodeConstants.Separator */)
                filename = "/" /* FsaToNodeConstants.Separator */ + filename;
            return (0, encoding_1.strToEncoding)(filename, encoding);
        };
        this.readSync = (fd, buffer, offset, length, position) => {
            util.validateFd(fd);
            const filename = this.getFileName(fd);
            const adapter = this.getSyncAdapter();
            const uint8 = adapter.call('read', [filename, position, length]);
            const dest = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            dest.set(uint8, offset);
            return uint8.length;
        };
        this.writeSync = (fd, a, b, c, d) => {
            const [, buf, offset, length, position] = util.getWriteSyncArgs(fd, a, b, c, d);
            const filename = this.getFileName(fd);
            const data = new Uint8Array(buf.buffer, buf.byteOffset + offset, length);
            return this.getSyncAdapter().call('write', [filename, data, position || null]);
        };
        this.openSync = (path, flags, mode = 438 /* MODE.DEFAULT */) => {
            const modeNum = util.modeToNumber(mode);
            const filename = util.pathToFilename(path);
            const flagsNum = util.flagsToNumber(flags);
            const adapter = this.getSyncAdapter();
            const handle = adapter.call('open', [filename, flagsNum, modeNum]);
            const openFile = this.__open2(handle, filename, flagsNum, modeNum);
            return openFile.fd;
        };
        this.writevSync = (fd, buffers, position) => {
            if (buffers.length === 0)
                return;
            this.writeSync(fd, buffers[0], 0, buffers[0].byteLength, position);
            for (let i = 1; i < buffers.length; i++) {
                this.writeSync(fd, buffers[i], 0, buffers[i].byteLength, null);
            }
        };
        this.fdatasyncSync = noop;
        this.fsyncSync = noop;
        this.chmodSync = noop;
        this.chownSync = noop;
        this.fchmodSync = noop;
        this.fchownSync = noop;
        this.futimesSync = noop;
        this.lchmodSync = noop;
        this.lchownSync = noop;
        this.utimesSync = noop;
        this.lutimesSync = noop;
        this.cpSync = notImplemented;
        this.opendirSync = notImplemented;
        this.statfsSync = notImplemented;
        this.readvSync = notImplemented;
        this.symlinkSync = notSupported;
        this.linkSync = notSupported;
        // ---------------------------------------------------------- FsCommonObjects
        this.F_OK = constants_2.constants.F_OK;
        this.R_OK = constants_2.constants.R_OK;
        this.W_OK = constants_2.constants.W_OK;
        this.X_OK = constants_2.constants.X_OK;
        this.constants = constants_2.constants;
        this.Dirent = FsaNodeDirent_1.FsaNodeDirent;
        this.Stats = (FsaNodeStats_1.FsaNodeStats);
        this.WriteStream = FsaNodeWriteStream_1.FsaNodeWriteStream;
        this.ReadStream = FsaNodeReadStream_1.FsaNodeReadStream;
        this.StatFs = 0;
        this.Dir = 0;
        this.StatsWatcher = 0;
        this.FSWatcher = 0;
    }
    async getHandleStats(bigint, handle) {
        let size = 0;
        if (handle.kind === 'file') {
            const file = handle;
            const fileData = await file.getFile();
            size = fileData.size;
        }
        const stats = new FsaNodeStats_1.FsaNodeStats(bigint, bigint ? BigInt(size) : size, handle.kind);
        return stats;
    }
    rmAll(callback) {
        (async () => {
            var _a, e_3, _b, _c;
            const root = await this.root;
            try {
                for (var _d = true, _e = tslib_1.__asyncValues(root.keys()), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const name = _c;
                    await root.removeEntry(name, { recursive: true });
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
        })().then(() => callback(null), error => callback(error));
    }
}
exports.FsaNodeFs = FsaNodeFs;
//# sourceMappingURL=FsaNodeFs.js.map