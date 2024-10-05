"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHandle = void 0;
const util_1 = require("./util");
class FileHandle {
    constructor(fs, fd) {
        this.fs = fs;
        this.fd = fd;
    }
    appendFile(data, options) {
        return (0, util_1.promisify)(this.fs, 'appendFile')(this.fd, data, options);
    }
    chmod(mode) {
        return (0, util_1.promisify)(this.fs, 'fchmod')(this.fd, mode);
    }
    chown(uid, gid) {
        return (0, util_1.promisify)(this.fs, 'fchown')(this.fd, uid, gid);
    }
    close() {
        return (0, util_1.promisify)(this.fs, 'close')(this.fd);
    }
    datasync() {
        return (0, util_1.promisify)(this.fs, 'fdatasync')(this.fd);
    }
    readableWebStream(options) {
        return new ReadableStream({
            pull: async (controller) => {
                const data = await this.readFile();
                controller.enqueue(data);
                controller.close();
            },
        });
    }
    read(buffer, offset, length, position) {
        return (0, util_1.promisify)(this.fs, 'read', bytesRead => ({ bytesRead, buffer }))(this.fd, buffer, offset, length, position);
    }
    readv(buffers, position) {
        return (0, util_1.promisify)(this.fs, 'readv', bytesRead => ({ bytesRead, buffers }))(this.fd, buffers, position);
    }
    readFile(options) {
        return (0, util_1.promisify)(this.fs, 'readFile')(this.fd, options);
    }
    stat(options) {
        return (0, util_1.promisify)(this.fs, 'fstat')(this.fd, options);
    }
    sync() {
        return (0, util_1.promisify)(this.fs, 'fsync')(this.fd);
    }
    truncate(len) {
        return (0, util_1.promisify)(this.fs, 'ftruncate')(this.fd, len);
    }
    utimes(atime, mtime) {
        return (0, util_1.promisify)(this.fs, 'futimes')(this.fd, atime, mtime);
    }
    write(buffer, offset, length, position) {
        return (0, util_1.promisify)(this.fs, 'write', bytesWritten => ({ bytesWritten, buffer }))(this.fd, buffer, offset, length, position);
    }
    writev(buffers, position) {
        return (0, util_1.promisify)(this.fs, 'writev', bytesWritten => ({ bytesWritten, buffers }))(this.fd, buffers, position);
    }
    writeFile(data, options) {
        return (0, util_1.promisify)(this.fs, 'writeFile')(this.fd, data, options);
    }
}
exports.FileHandle = FileHandle;
//# sourceMappingURL=FileHandle.js.map