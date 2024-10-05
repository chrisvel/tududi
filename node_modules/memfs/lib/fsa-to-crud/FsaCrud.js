"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsaCrud = void 0;
const tslib_1 = require("tslib");
const util_1 = require("../node-to-fsa/util");
const util_2 = require("../crud/util");
const util_3 = require("./util");
class FsaCrud {
    constructor(root) {
        this.root = root;
        this.put = async (collection, id, data, options) => {
            (0, util_2.assertType)(collection, 'put', 'crudfs');
            (0, util_1.assertName)(id, 'put', 'crudfs');
            const [dir] = await this.getDir(collection, true);
            let file;
            switch (options === null || options === void 0 ? void 0 : options.throwIf) {
                case 'exists': {
                    try {
                        file = await dir.getFileHandle(id, { create: false });
                        throw (0, util_3.newExistsError)();
                    }
                    catch (e) {
                        if (e.name !== 'NotFoundError')
                            throw e;
                        file = await dir.getFileHandle(id, { create: true });
                    }
                    break;
                }
                case 'missing': {
                    try {
                        file = await dir.getFileHandle(id, { create: false });
                    }
                    catch (e) {
                        if (e.name === 'NotFoundError')
                            throw (0, util_3.newMissingError)();
                        throw e;
                    }
                    break;
                }
                default: {
                    file = await dir.getFileHandle(id, { create: true });
                }
            }
            const writable = await file.createWritable();
            await writable.write(data);
            await writable.close();
        };
        this.get = async (collection, id) => {
            (0, util_2.assertType)(collection, 'get', 'crudfs');
            (0, util_1.assertName)(id, 'get', 'crudfs');
            const [, file] = await this.getFile(collection, id);
            const blob = await file.getFile();
            const buffer = await blob.arrayBuffer();
            return new Uint8Array(buffer);
        };
        this.del = async (collection, id, silent) => {
            (0, util_2.assertType)(collection, 'del', 'crudfs');
            (0, util_1.assertName)(id, 'del', 'crudfs');
            try {
                const [dir] = await this.getFile(collection, id);
                await dir.removeEntry(id, { recursive: false });
            }
            catch (error) {
                if (!silent)
                    throw error;
            }
        };
        this.info = async (collection, id) => {
            (0, util_2.assertType)(collection, 'info', 'crudfs');
            if (id) {
                (0, util_1.assertName)(id, 'info', 'crudfs');
                const [, file] = await this.getFile(collection, id);
                const blob = await file.getFile();
                return {
                    type: 'resource',
                    id,
                    size: blob.size,
                    modified: blob.lastModified,
                };
            }
            else {
                await this.getDir(collection, false);
                return {
                    type: 'collection',
                    id: '',
                };
            }
        };
        this.drop = async (collection, silent) => {
            var _a, e_1, _b, _c;
            (0, util_2.assertType)(collection, 'drop', 'crudfs');
            try {
                const [dir, parent] = await this.getDir(collection, false);
                if (parent) {
                    await parent.removeEntry(dir.name, { recursive: true });
                }
                else {
                    const root = await this.root;
                    try {
                        for (var _d = true, _e = tslib_1.__asyncValues(root.keys()), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const name = _c;
                            await root.removeEntry(name, { recursive: true });
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                }
            }
            catch (error) {
                if (!silent)
                    throw error;
            }
        };
        this.scan = function (collection) {
            return tslib_1.__asyncGenerator(this, arguments, function* () {
                var _a, e_2, _b, _c;
                (0, util_2.assertType)(collection, 'scan', 'crudfs');
                const [dir] = yield tslib_1.__await(this.getDir(collection, false));
                try {
                    for (var _d = true, _e = tslib_1.__asyncValues(dir.entries()), _f; _f = yield tslib_1.__await(_e.next()), _a = _f.done, !_a; _d = true) {
                        _c = _f.value;
                        _d = false;
                        const [id, handle] = _c;
                        if (handle.kind === 'file') {
                            yield yield tslib_1.__await({
                                type: 'resource',
                                id,
                            });
                        }
                        else if (handle.kind === 'directory') {
                            yield yield tslib_1.__await({
                                type: 'collection',
                                id,
                            });
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield tslib_1.__await(_b.call(_e));
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            });
        };
        this.list = async (collection) => {
            var _a, e_3, _b, _c;
            const entries = [];
            try {
                for (var _d = true, _e = tslib_1.__asyncValues(this.scan(collection)), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const entry = _c;
                    entries.push(entry);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return entries;
        };
        this.from = async (collection) => {
            (0, util_2.assertType)(collection, 'from', 'crudfs');
            const [dir] = await this.getDir(collection, true);
            return new FsaCrud(dir);
        };
    }
    async getDir(collection, create) {
        let parent = undefined;
        let dir = await this.root;
        try {
            for (const name of collection) {
                const child = await dir.getDirectoryHandle(name, { create });
                parent = dir;
                dir = child;
            }
            return [dir, parent];
        }
        catch (error) {
            if (error.name === 'NotFoundError')
                throw (0, util_3.newFolder404Error)(collection);
            throw error;
        }
    }
    async getFile(collection, id) {
        const [dir] = await this.getDir(collection, false);
        try {
            const file = await dir.getFileHandle(id, { create: false });
            return [dir, file];
        }
        catch (error) {
            if (error.name === 'NotFoundError')
                throw (0, util_3.newFile404Error)(collection, id);
            throw error;
        }
    }
}
exports.FsaCrud = FsaCrud;
//# sourceMappingURL=FsaCrud.js.map