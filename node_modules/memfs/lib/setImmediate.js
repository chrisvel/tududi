"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let _setImmediate;
if (typeof setImmediate === 'function')
    _setImmediate = setImmediate.bind(typeof globalThis !== 'undefined' ? globalThis : global);
else
    _setImmediate = setTimeout.bind(typeof globalThis !== 'undefined' ? globalThis : global);
exports.default = _setImmediate;
//# sourceMappingURL=setImmediate.js.map