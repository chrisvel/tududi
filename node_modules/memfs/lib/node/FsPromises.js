"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsPromises = void 0;
const util_1 = require("./util");
const constants_1 = require("../constants");
class FsPromises {
    constructor(fs, FileHandle) {
        this.fs = fs;
        this.FileHandle = FileHandle;
        this.constants = constants_1.constants;
        this.cp = (0, util_1.promisify)(this.fs, 'cp');
        this.opendir = (0, util_1.promisify)(this.fs, 'opendir');
        this.statfs = (0, util_1.promisify)(this.fs, 'statfs');
        this.lutimes = (0, util_1.promisify)(this.fs, 'lutimes');
        this.access = (0, util_1.promisify)(this.fs, 'access');
        this.chmod = (0, util_1.promisify)(this.fs, 'chmod');
        this.chown = (0, util_1.promisify)(this.fs, 'chown');
        this.copyFile = (0, util_1.promisify)(this.fs, 'copyFile');
        this.lchmod = (0, util_1.promisify)(this.fs, 'lchmod');
        this.lchown = (0, util_1.promisify)(this.fs, 'lchown');
        this.link = (0, util_1.promisify)(this.fs, 'link');
        this.lstat = (0, util_1.promisify)(this.fs, 'lstat');
        this.mkdir = (0, util_1.promisify)(this.fs, 'mkdir');
        this.mkdtemp = (0, util_1.promisify)(this.fs, 'mkdtemp');
        this.readdir = (0, util_1.promisify)(this.fs, 'readdir');
        this.readlink = (0, util_1.promisify)(this.fs, 'readlink');
        this.realpath = (0, util_1.promisify)(this.fs, 'realpath');
        this.rename = (0, util_1.promisify)(this.fs, 'rename');
        this.rmdir = (0, util_1.promisify)(this.fs, 'rmdir');
        this.rm = (0, util_1.promisify)(this.fs, 'rm');
        this.stat = (0, util_1.promisify)(this.fs, 'stat');
        this.symlink = (0, util_1.promisify)(this.fs, 'symlink');
        this.truncate = (0, util_1.promisify)(this.fs, 'truncate');
        this.unlink = (0, util_1.promisify)(this.fs, 'unlink');
        this.utimes = (0, util_1.promisify)(this.fs, 'utimes');
        this.readFile = (id, options) => {
            return (0, util_1.promisify)(this.fs, 'readFile')(id instanceof this.FileHandle ? id.fd : id, options);
        };
        this.appendFile = (path, data, options) => {
            return (0, util_1.promisify)(this.fs, 'appendFile')(path instanceof this.FileHandle ? path.fd : path, data, options);
        };
        this.open = (path, flags = 'r', mode) => {
            return (0, util_1.promisify)(this.fs, 'open', fd => new this.FileHandle(this.fs, fd))(path, flags, mode);
        };
        this.writeFile = (id, data, options) => {
            return (0, util_1.promisify)(this.fs, 'writeFile')(id instanceof this.FileHandle ? id.fd : id, data, options);
        };
        this.watch = () => {
            throw new Error('Not implemented');
        };
    }
}
exports.FsPromises = FsPromises;
//# sourceMappingURL=FsPromises.js.map