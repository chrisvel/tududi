"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dir = void 0;
const util_1 = require("./node/util");
const Dirent_1 = require("./Dirent");
/**
 * A directory stream, like `fs.Dir`.
 */
class Dir {
    constructor(link, options) {
        this.link = link;
        this.options = options;
        this.iteratorInfo = [];
        this.path = link.getParentPath();
        this.iteratorInfo.push(link.children[Symbol.iterator]());
    }
    wrapAsync(method, args, callback) {
        (0, util_1.validateCallback)(callback);
        setImmediate(() => {
            let result;
            try {
                result = method.apply(this, args);
            }
            catch (err) {
                callback(err);
                return;
            }
            callback(null, result);
        });
    }
    isFunction(x) {
        return typeof x === 'function';
    }
    promisify(obj, fn) {
        return (...args) => new Promise((resolve, reject) => {
            if (this.isFunction(obj[fn])) {
                obj[fn].bind(obj)(...args, (error, result) => {
                    if (error)
                        reject(error);
                    resolve(result);
                });
            }
            else {
                reject('Not a function');
            }
        });
    }
    closeBase() { }
    readBase(iteratorInfo) {
        let done;
        let value;
        let name;
        let link;
        do {
            do {
                ({ done, value } = iteratorInfo[iteratorInfo.length - 1].next());
                if (!done) {
                    [name, link] = value;
                }
                else {
                    break;
                }
            } while (name === '.' || name === '..');
            if (done) {
                iteratorInfo.pop();
                if (iteratorInfo.length === 0) {
                    break;
                }
                else {
                    done = false;
                }
            }
            else {
                if (this.options.recursive && link.children.size) {
                    iteratorInfo.push(link.children[Symbol.iterator]());
                }
                return Dirent_1.default.build(link, this.options.encoding);
            }
        } while (!done);
        return null;
    }
    closeBaseAsync(callback) {
        this.wrapAsync(this.closeBase, [], callback);
    }
    close(callback) {
        if (typeof callback === 'function') {
            this.closeBaseAsync(callback);
        }
        else {
            return this.promisify(this, 'closeBaseAsync')();
        }
    }
    closeSync() {
        this.closeBase();
    }
    readBaseAsync(callback) {
        this.wrapAsync(this.readBase, [this.iteratorInfo], callback);
    }
    read(callback) {
        if (typeof callback === 'function') {
            this.readBaseAsync(callback);
        }
        else {
            return this.promisify(this, 'readBaseAsync')();
        }
    }
    readSync() {
        return this.readBase(this.iteratorInfo);
    }
    [Symbol.asyncIterator]() {
        const iteratorInfo = [];
        const _this = this;
        iteratorInfo.push(_this.link.children[Symbol.iterator]());
        // auxiliary object so promisify() can be used
        const o = {
            readBaseAsync(callback) {
                _this.wrapAsync(_this.readBase, [iteratorInfo], callback);
            },
        };
        return {
            async next() {
                const dirEnt = await _this.promisify(o, 'readBaseAsync')();
                if (dirEnt !== null) {
                    return { done: false, value: dirEnt };
                }
                else {
                    return { done: true, value: undefined };
                }
            },
            [Symbol.asyncIterator]() {
                throw new Error('Not implemented');
            },
        };
    }
}
exports.Dir = Dir;
//# sourceMappingURL=Dir.js.map