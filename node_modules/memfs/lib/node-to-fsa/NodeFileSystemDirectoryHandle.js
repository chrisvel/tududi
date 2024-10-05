"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFileSystemDirectoryHandle = void 0;
const tslib_1 = require("tslib");
const NodeFileSystemHandle_1 = require("./NodeFileSystemHandle");
const util_1 = require("./util");
const NodeFileSystemFileHandle_1 = require("./NodeFileSystemFileHandle");
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
 */
class NodeFileSystemDirectoryHandle extends NodeFileSystemHandle_1.NodeFileSystemHandle {
    constructor(fs, path, ctx = {}) {
        super('directory', (0, util_1.basename)(path, ctx.separator || '/'));
        this.fs = fs;
        this.ctx = (0, util_1.ctx)(ctx);
        this.__path = path[path.length - 1] === this.ctx.separator ? path : path + this.ctx.separator;
    }
    /**
     * Returns a new array iterator containing the keys for each item in
     * {@link NodeFileSystemDirectoryHandle} object.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/keys
     */
    keys() {
        return tslib_1.__asyncGenerator(this, arguments, function* keys_1() {
            const list = yield tslib_1.__await(this.fs.promises.readdir(this.__path));
            for (const name of list)
                yield yield tslib_1.__await('' + name);
        });
    }
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/entries
     */
    entries() {
        return tslib_1.__asyncGenerator(this, arguments, function* entries_1() {
            const { __path: path, fs, ctx } = this;
            const list = yield tslib_1.__await(fs.promises.readdir(path, { withFileTypes: true }));
            for (const d of list) {
                const dirent = d;
                const name = dirent.name + '';
                const newPath = path + name;
                if (dirent.isDirectory())
                    yield yield tslib_1.__await([name, new NodeFileSystemDirectoryHandle(fs, newPath, ctx)]);
                else if (dirent.isFile())
                    yield yield tslib_1.__await([name, new NodeFileSystemFileHandle_1.NodeFileSystemFileHandle(fs, newPath, ctx)]);
            }
        });
    }
    /**
     * Returns a new array iterator containing the values for each index in the
     * {@link FileSystemDirectoryHandle} object.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/values
     */
    values() {
        return tslib_1.__asyncGenerator(this, arguments, function* values_1() {
            var _a, e_1, _b, _c;
            try {
                for (var _d = true, _e = tslib_1.__asyncValues(this.entries()), _f; _f = yield tslib_1.__await(_e.next()), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const [, value] = _c;
                    yield yield tslib_1.__await(value);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield tslib_1.__await(_b.call(_e));
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    /**
     * Returns a {@link NodeFileSystemDirectoryHandle} for a subdirectory with the specified
     * name within the directory handle on which the method is called.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle
     * @param name A string representing the {@link NodeFileSystemHandle} name of
     *        the subdirectory you wish to retrieve.
     * @param options An optional object containing options for the retrieved
     *        subdirectory.
     */
    async getDirectoryHandle(name, options) {
        (0, util_1.assertName)(name, 'getDirectoryHandle', 'FileSystemDirectoryHandle');
        const filename = this.__path + name;
        try {
            const stats = await this.fs.promises.stat(filename);
            if (!stats.isDirectory())
                throw (0, util_1.newTypeMismatchError)();
            return new NodeFileSystemDirectoryHandle(this.fs, filename, this.ctx);
        }
        catch (error) {
            if (error instanceof DOMException)
                throw error;
            if (error && typeof error === 'object') {
                switch (error.code) {
                    case 'ENOENT': {
                        if (options === null || options === void 0 ? void 0 : options.create) {
                            (0, util_1.assertCanWrite)(this.ctx.mode);
                            await this.fs.promises.mkdir(filename);
                            return new NodeFileSystemDirectoryHandle(this.fs, filename, this.ctx);
                        }
                        throw (0, util_1.newNotFoundError)();
                    }
                    case 'EPERM':
                    case 'EACCES':
                        throw (0, util_1.newNotAllowedError)();
                }
            }
            throw error;
        }
    }
    /**
     * Returns a {@link FileSystemFileHandle} for a file with the specified name,
     * within the directory the method is called.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle
     * @param name A string representing the {@link NodeFileSystemHandle} name of
     *        the file you wish to retrieve.
     * @param options An optional object containing options for the retrieved file.
     */
    async getFileHandle(name, options) {
        (0, util_1.assertName)(name, 'getFileHandle', 'FileSystemDirectoryHandle');
        const filename = this.__path + name;
        try {
            const stats = await this.fs.promises.stat(filename);
            if (!stats.isFile())
                throw (0, util_1.newTypeMismatchError)();
            return new NodeFileSystemFileHandle_1.NodeFileSystemFileHandle(this.fs, filename, this.ctx);
        }
        catch (error) {
            if (error instanceof DOMException)
                throw error;
            if (error && typeof error === 'object') {
                switch (error.code) {
                    case 'ENOENT': {
                        if (options === null || options === void 0 ? void 0 : options.create) {
                            (0, util_1.assertCanWrite)(this.ctx.mode);
                            await this.fs.promises.writeFile(filename, '');
                            return new NodeFileSystemFileHandle_1.NodeFileSystemFileHandle(this.fs, filename, this.ctx);
                        }
                        throw (0, util_1.newNotFoundError)();
                    }
                    case 'EPERM':
                    case 'EACCES':
                        throw (0, util_1.newNotAllowedError)();
                }
            }
            throw error;
        }
    }
    /**
     * Attempts to remove an entry if the directory handle contains a file or
     * directory called the name specified.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
     * @param name A string representing the {@link FileSystemHandle} name of the
     *        entry you wish to remove.
     * @param options An optional object containing options.
     */
    async removeEntry(name, { recursive = false } = {}) {
        (0, util_1.assertCanWrite)(this.ctx.mode);
        (0, util_1.assertName)(name, 'removeEntry', 'FileSystemDirectoryHandle');
        const filename = this.__path + name;
        const promises = this.fs.promises;
        try {
            const stats = await promises.stat(filename);
            if (stats.isFile()) {
                await promises.unlink(filename);
            }
            else if (stats.isDirectory()) {
                await promises.rmdir(filename, { recursive });
            }
            else
                throw (0, util_1.newTypeMismatchError)();
        }
        catch (error) {
            if (error instanceof DOMException)
                throw error;
            if (error && typeof error === 'object') {
                switch (error.code) {
                    case 'ENOENT': {
                        throw (0, util_1.newNotFoundError)();
                    }
                    case 'EPERM':
                    case 'EACCES':
                        throw (0, util_1.newNotAllowedError)();
                    case 'ENOTEMPTY':
                        throw new DOMException('The object can not be modified in this way.', 'InvalidModificationError');
                }
            }
            throw error;
        }
    }
    /**
     * The `resolve()` method of the {@link FileSystemDirectoryHandle} interface
     * returns an {@link Array} of directory names from the parent handle to the specified
     * child entry, with the name of the child entry as the last array item.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/resolve
     * @param possibleDescendant The {@link NodeFileSystemFileHandle} from which
     *        to return the relative path.
     */
    async resolve(possibleDescendant) {
        if (possibleDescendant instanceof NodeFileSystemDirectoryHandle ||
            possibleDescendant instanceof NodeFileSystemFileHandle_1.NodeFileSystemFileHandle) {
            const path = this.__path;
            const childPath = possibleDescendant.__path;
            if (!childPath.startsWith(path))
                return null;
            let relative = childPath.slice(path.length);
            if (relative === '')
                return [];
            const separator = this.ctx.separator;
            if (relative[0] === separator)
                relative = relative.slice(1);
            return relative.split(separator);
        }
        return null;
    }
}
exports.NodeFileSystemDirectoryHandle = NodeFileSystemDirectoryHandle;
//# sourceMappingURL=NodeFileSystemDirectoryHandle.js.map