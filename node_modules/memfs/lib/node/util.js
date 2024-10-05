"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unixify = exports.getWriteSyncArgs = exports.getWriteArgs = exports.bufToUint8 = exports.isWin = void 0;
exports.promisify = promisify;
exports.validateCallback = validateCallback;
exports.modeToNumber = modeToNumber;
exports.nullCheck = nullCheck;
exports.pathToFilename = pathToFilename;
exports.createError = createError;
exports.genRndStr6 = genRndStr6;
exports.flagsToNumber = flagsToNumber;
exports.isFd = isFd;
exports.validateFd = validateFd;
exports.dataToBuffer = dataToBuffer;
exports.bufferToEncoding = bufferToEncoding;
const constants_1 = require("./constants");
const errors = require("../internal/errors");
const buffer_1 = require("../internal/buffer");
const encoding_1 = require("../encoding");
const buffer_2 = require("../internal/buffer");
const queueMicrotask_1 = require("../queueMicrotask");
exports.isWin = process.platform === 'win32';
function promisify(fs, fn, getResult = input => input) {
    return (...args) => new Promise((resolve, reject) => {
        fs[fn].bind(fs)(...args, (error, result) => {
            if (error)
                return reject(error);
            return resolve(getResult(result));
        });
    });
}
function validateCallback(callback) {
    if (typeof callback !== 'function')
        throw TypeError(constants_1.ERRSTR.CB);
    return callback;
}
function _modeToNumber(mode, def) {
    if (typeof mode === 'number')
        return mode;
    if (typeof mode === 'string')
        return parseInt(mode, 8);
    if (def)
        return modeToNumber(def);
    return undefined;
}
function modeToNumber(mode, def) {
    const result = _modeToNumber(mode, def);
    if (typeof result !== 'number' || isNaN(result))
        throw new TypeError(constants_1.ERRSTR.MODE_INT);
    return result;
}
function nullCheck(path, callback) {
    if (('' + path).indexOf('\u0000') !== -1) {
        const er = new Error('Path must be a string without null bytes');
        er.code = 'ENOENT';
        if (typeof callback !== 'function')
            throw er;
        (0, queueMicrotask_1.default)(() => {
            callback(er);
        });
        return false;
    }
    return true;
}
function getPathFromURLPosix(url) {
    if (url.hostname !== '') {
        throw new errors.TypeError('ERR_INVALID_FILE_URL_HOST', process.platform);
    }
    const pathname = url.pathname;
    for (let n = 0; n < pathname.length; n++) {
        if (pathname[n] === '%') {
            const third = pathname.codePointAt(n + 2) | 0x20;
            if (pathname[n + 1] === '2' && third === 102) {
                throw new errors.TypeError('ERR_INVALID_FILE_URL_PATH', 'must not include encoded / characters');
            }
        }
    }
    return decodeURIComponent(pathname);
}
function pathToFilename(path) {
    if (typeof path !== 'string' && !buffer_1.Buffer.isBuffer(path)) {
        try {
            if (!(path instanceof require('url').URL))
                throw new TypeError(constants_1.ERRSTR.PATH_STR);
        }
        catch (err) {
            throw new TypeError(constants_1.ERRSTR.PATH_STR);
        }
        path = getPathFromURLPosix(path);
    }
    const pathString = String(path);
    nullCheck(pathString);
    // return slash(pathString);
    return pathString;
}
const ENOENT = 'ENOENT';
const EBADF = 'EBADF';
const EINVAL = 'EINVAL';
const EPERM = 'EPERM';
const EPROTO = 'EPROTO';
const EEXIST = 'EEXIST';
const ENOTDIR = 'ENOTDIR';
const EMFILE = 'EMFILE';
const EACCES = 'EACCES';
const EISDIR = 'EISDIR';
const ENOTEMPTY = 'ENOTEMPTY';
const ENOSYS = 'ENOSYS';
const ERR_FS_EISDIR = 'ERR_FS_EISDIR';
const ERR_OUT_OF_RANGE = 'ERR_OUT_OF_RANGE';
function formatError(errorCode, func = '', path = '', path2 = '') {
    let pathFormatted = '';
    if (path)
        pathFormatted = ` '${path}'`;
    if (path2)
        pathFormatted += ` -> '${path2}'`;
    switch (errorCode) {
        case ENOENT:
            return `ENOENT: no such file or directory, ${func}${pathFormatted}`;
        case EBADF:
            return `EBADF: bad file descriptor, ${func}${pathFormatted}`;
        case EINVAL:
            return `EINVAL: invalid argument, ${func}${pathFormatted}`;
        case EPERM:
            return `EPERM: operation not permitted, ${func}${pathFormatted}`;
        case EPROTO:
            return `EPROTO: protocol error, ${func}${pathFormatted}`;
        case EEXIST:
            return `EEXIST: file already exists, ${func}${pathFormatted}`;
        case ENOTDIR:
            return `ENOTDIR: not a directory, ${func}${pathFormatted}`;
        case EISDIR:
            return `EISDIR: illegal operation on a directory, ${func}${pathFormatted}`;
        case EACCES:
            return `EACCES: permission denied, ${func}${pathFormatted}`;
        case ENOTEMPTY:
            return `ENOTEMPTY: directory not empty, ${func}${pathFormatted}`;
        case EMFILE:
            return `EMFILE: too many open files, ${func}${pathFormatted}`;
        case ENOSYS:
            return `ENOSYS: function not implemented, ${func}${pathFormatted}`;
        case ERR_FS_EISDIR:
            return `[ERR_FS_EISDIR]: Path is a directory: ${func} returned EISDIR (is a directory) ${path}`;
        case ERR_OUT_OF_RANGE:
            return `[ERR_OUT_OF_RANGE]: value out of range, ${func}${pathFormatted}`;
        default:
            return `${errorCode}: error occurred, ${func}${pathFormatted}`;
    }
}
function createError(errorCode, func = '', path = '', path2 = '', Constructor = Error) {
    const error = new Constructor(formatError(errorCode, func, path, path2));
    error.code = errorCode;
    if (path) {
        error.path = path;
    }
    return error;
}
function genRndStr6() {
    const str = (Math.random() + 1).toString(36).substring(2, 8);
    if (str.length === 6)
        return str;
    else
        return genRndStr6();
}
function flagsToNumber(flags) {
    if (typeof flags === 'number')
        return flags;
    if (typeof flags === 'string') {
        const flagsNum = constants_1.FLAGS[flags];
        if (typeof flagsNum !== 'undefined')
            return flagsNum;
    }
    // throw new TypeError(formatError(ERRSTR_FLAG(flags)));
    throw new errors.TypeError('ERR_INVALID_OPT_VALUE', 'flags', flags);
}
function isFd(path) {
    return path >>> 0 === path;
}
function validateFd(fd) {
    if (!isFd(fd))
        throw TypeError(constants_1.ERRSTR.FD);
}
function dataToBuffer(data, encoding = encoding_1.ENCODING_UTF8) {
    if (buffer_1.Buffer.isBuffer(data))
        return data;
    else if (data instanceof Uint8Array)
        return (0, buffer_2.bufferFrom)(data);
    else
        return (0, buffer_2.bufferFrom)(String(data), encoding);
}
const bufToUint8 = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
exports.bufToUint8 = bufToUint8;
const getWriteArgs = (fd, a, b, c, d, e) => {
    validateFd(fd);
    let offset = 0;
    let length;
    let position = null;
    let encoding;
    let callback;
    const tipa = typeof a;
    const tipb = typeof b;
    const tipc = typeof c;
    const tipd = typeof d;
    if (tipa !== 'string') {
        if (tipb === 'function') {
            callback = b;
        }
        else if (tipc === 'function') {
            offset = b | 0;
            callback = c;
        }
        else if (tipd === 'function') {
            offset = b | 0;
            length = c;
            callback = d;
        }
        else {
            offset = b | 0;
            length = c;
            position = d;
            callback = e;
        }
    }
    else {
        if (tipb === 'function') {
            callback = b;
        }
        else if (tipc === 'function') {
            position = b;
            callback = c;
        }
        else if (tipd === 'function') {
            position = b;
            encoding = c;
            callback = d;
        }
    }
    const buf = dataToBuffer(a, encoding);
    if (tipa !== 'string') {
        if (typeof length === 'undefined')
            length = buf.length;
    }
    else {
        offset = 0;
        length = buf.length;
    }
    const cb = validateCallback(callback);
    return [fd, tipa === 'string', buf, offset, length, position, cb];
};
exports.getWriteArgs = getWriteArgs;
const getWriteSyncArgs = (fd, a, b, c, d) => {
    validateFd(fd);
    let encoding;
    let offset;
    let length;
    let position;
    const isBuffer = typeof a !== 'string';
    if (isBuffer) {
        offset = (b || 0) | 0;
        length = c;
        position = d;
    }
    else {
        position = b;
        encoding = c;
    }
    const buf = dataToBuffer(a, encoding);
    if (isBuffer) {
        if (typeof length === 'undefined') {
            length = buf.length;
        }
    }
    else {
        offset = 0;
        length = buf.length;
    }
    return [fd, buf, offset || 0, length, position];
};
exports.getWriteSyncArgs = getWriteSyncArgs;
function bufferToEncoding(buffer, encoding) {
    if (!encoding || encoding === 'buffer')
        return buffer;
    else
        return buffer.toString(encoding);
}
const isSeparator = (str, i) => {
    let char = str[i];
    return i > 0 && (char === '/' || (exports.isWin && char === '\\'));
};
const removeTrailingSeparator = (str) => {
    let i = str.length - 1;
    if (i < 2)
        return str;
    while (isSeparator(str, i))
        i--;
    return str.substr(0, i + 1);
};
const normalizePath = (str, stripTrailing) => {
    if (typeof str !== 'string')
        throw new TypeError('expected a string');
    str = str.replace(/[\\\/]+/g, '/');
    if (stripTrailing !== false)
        str = removeTrailingSeparator(str);
    return str;
};
const unixify = (filepath, stripTrailing = true) => {
    if (exports.isWin) {
        filepath = normalizePath(filepath, stripTrailing);
        return filepath.replace(/^([a-zA-Z]+:|\.\/)/, '');
    }
    return filepath;
};
exports.unixify = unixify;
//# sourceMappingURL=util.js.map