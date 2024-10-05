"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeCrud = void 0;
const tslib_1 = require("tslib");
const util_1 = require("../node-to-fsa/util");
const util_2 = require("../crud/util");
const util_3 = require("../fsa-to-crud/util");
class NodeCrud {
    constructor(options) {
        var _a;
        this.options = options;
        this.put = async (collection, id, data, options) => {
            (0, util_2.assertType)(collection, 'put', 'crudfs');
            (0, util_1.assertName)(id, 'put', 'crudfs');
            const dir = this.dir + (collection.length ? collection.join(this.separator) + this.separator : '');
            const fs = this.fs;
            if (dir.length > 1)
                await fs.mkdir(dir, { recursive: true });
            const filename = dir + id;
            switch (options === null || options === void 0 ? void 0 : options.throwIf) {
                case 'exists': {
                    try {
                        await fs.writeFile(filename, data, { flag: 64 /* FLAG.O_CREAT */ | 128 /* FLAG.O_EXCL */ });
                    }
                    catch (error) {
                        if (error && typeof error === 'object' && error.code === 'EEXIST')
                            throw (0, util_3.newExistsError)();
                        throw error;
                    }
                    break;
                }
                case 'missing': {
                    try {
                        await fs.writeFile(filename, data, { flag: 2 /* FLAG.O_RDWR */ });
                    }
                    catch (error) {
                        if (error && typeof error === 'object' && error.code === 'ENOENT')
                            throw (0, util_3.newMissingError)();
                        throw error;
                    }
                    break;
                }
                default: {
                    await fs.writeFile(filename, data);
                }
            }
        };
        this.get = async (collection, id) => {
            (0, util_2.assertType)(collection, 'get', 'crudfs');
            (0, util_1.assertName)(id, 'get', 'crudfs');
            const dir = await this.checkDir(collection);
            const filename = dir + id;
            const fs = this.fs;
            try {
                const buf = (await fs.readFile(filename));
                return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
            }
            catch (error) {
                if (error && typeof error === 'object') {
                    switch (error.code) {
                        case 'ENOENT':
                            throw (0, util_3.newFile404Error)(collection, id);
                    }
                }
                throw error;
            }
        };
        this.del = async (collection, id, silent) => {
            (0, util_2.assertType)(collection, 'del', 'crudfs');
            (0, util_1.assertName)(id, 'del', 'crudfs');
            try {
                const dir = await this.checkDir(collection);
                const filename = dir + id;
                await this.fs.unlink(filename);
            }
            catch (error) {
                if (!!silent)
                    return;
                if (error && typeof error === 'object') {
                    switch (error.code) {
                        case 'ENOENT':
                            throw (0, util_3.newFile404Error)(collection, id);
                    }
                }
                throw error;
            }
        };
        this.info = async (collection, id) => {
            (0, util_2.assertType)(collection, 'info', 'crudfs');
            if (id) {
                (0, util_1.assertName)(id, 'info', 'crudfs');
                await this.checkDir(collection);
                try {
                    const stats = await this.fs.stat(this.dir + collection.join(this.separator) + this.separator + id);
                    if (!stats.isFile())
                        throw (0, util_3.newFile404Error)(collection, id);
                    return {
                        type: 'resource',
                        id,
                        size: stats.size,
                        modified: stats.mtimeMs,
                    };
                }
                catch (error) {
                    if (error && typeof error === 'object') {
                        switch (error.code) {
                            case 'ENOENT':
                                throw (0, util_3.newFile404Error)(collection, id);
                        }
                    }
                    throw error;
                }
            }
            else {
                await this.checkDir(collection);
                try {
                    const stats = await this.fs.stat(this.dir + collection.join(this.separator));
                    if (!stats.isDirectory())
                        throw (0, util_3.newFolder404Error)(collection);
                    return {
                        type: 'collection',
                        id: '',
                    };
                }
                catch (error) {
                    if (error && typeof error === 'object') {
                        switch (error.code) {
                            case 'ENOENT':
                            case 'ENOTDIR':
                                throw (0, util_3.newFolder404Error)(collection);
                        }
                    }
                    throw error;
                }
            }
        };
        this.drop = async (collection, silent) => {
            (0, util_2.assertType)(collection, 'drop', 'crudfs');
            try {
                const dir = await this.checkDir(collection);
                const isRoot = dir === this.dir;
                if (isRoot) {
                    const list = (await this.fs.readdir(dir));
                    for (const entry of list)
                        await this.fs.rmdir(dir + entry, { recursive: true });
                }
                else {
                    await this.fs.rmdir(dir, { recursive: true });
                }
            }
            catch (error) {
                if (!silent)
                    throw error;
            }
        };
        this.scan = function (collection) {
            return tslib_1.__asyncGenerator(this, arguments, function* () {
                var _a, e_1, _b, _c;
                (0, util_2.assertType)(collection, 'scan', 'crudfs');
                const dir = yield tslib_1.__await(this.checkDir(collection));
                const dirents = (yield tslib_1.__await(this.fs.readdir(dir, { withFileTypes: true })));
                try {
                    for (var _d = true, dirents_1 = tslib_1.__asyncValues(dirents), dirents_1_1; dirents_1_1 = yield tslib_1.__await(dirents_1.next()), _a = dirents_1_1.done, !_a; _d = true) {
                        _c = dirents_1_1.value;
                        _d = false;
                        const entry = _c;
                        if (entry.isFile()) {
                            yield yield tslib_1.__await({
                                type: 'resource',
                                id: '' + entry.name,
                            });
                        }
                        else if (entry.isDirectory()) {
                            yield yield tslib_1.__await({
                                type: 'collection',
                                id: '' + entry.name,
                            });
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = dirents_1.return)) yield tslib_1.__await(_b.call(dirents_1));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            });
        };
        this.list = async (collection) => {
            var _a, e_2, _b, _c;
            const entries = [];
            try {
                for (var _d = true, _e = tslib_1.__asyncValues(this.scan(collection)), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const entry = _c;
                    entries.push(entry);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return entries;
        };
        this.from = async (collection) => {
            (0, util_2.assertType)(collection, 'from', 'crudfs');
            const dir = this.dir + (collection.length ? collection.join(this.separator) + this.separator : '');
            const fs = this.fs;
            if (dir.length > 1)
                await fs.mkdir(dir, { recursive: true });
            await this.checkDir(collection);
            return new NodeCrud({
                dir,
                fs: this.fs,
                separator: this.separator,
            });
        };
        this.separator = (_a = options.separator) !== null && _a !== void 0 ? _a : '/';
        let dir = options.dir;
        const last = dir[dir.length - 1];
        if (last !== this.separator)
            dir = dir + this.separator;
        this.dir = dir;
        this.fs = options.fs;
    }
    async checkDir(collection) {
        const dir = this.dir + (collection.length ? collection.join(this.separator) + this.separator : '');
        const fs = this.fs;
        try {
            const stats = await fs.stat(dir);
            if (!stats.isDirectory())
                throw (0, util_3.newFolder404Error)(collection);
            return dir;
        }
        catch (error) {
            if (error && typeof error === 'object') {
                switch (error.code) {
                    case 'ENOENT':
                    case 'ENOTDIR':
                        throw (0, util_3.newFolder404Error)(collection);
                }
            }
            throw error;
        }
    }
}
exports.NodeCrud = NodeCrud;
//# sourceMappingURL=NodeCrud.js.map