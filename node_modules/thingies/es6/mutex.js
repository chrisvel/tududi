"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mutex = void 0;
const tslib_1 = require("tslib");
const codeMutex_1 = require("./codeMutex");
/**
 * Executes only one instance of give code at a time. For parallel calls, it
 * returns the result of the ongoing execution.
 */
function mutex(fn, context) {
    const isDecorator = !!context;
    if (!isDecorator) {
        const mut = (0, codeMutex_1.codeMutex)();
        return function (...args) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                return yield mut(() => tslib_1.__awaiter(this, void 0, void 0, function* () { return yield fn.call(this, ...args); }));
            });
        };
    }
    const instances = new WeakMap();
    return function (...args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let map = instances.get(this);
            if (!map)
                instances.set(this, (map = new WeakMap()));
            if (!map.has(fn))
                map.set(fn, (0, codeMutex_1.codeMutex)());
            return yield map.get(fn)(() => tslib_1.__awaiter(this, void 0, void 0, function* () { return yield fn.call(this, ...args); }));
        });
    };
}
exports.mutex = mutex;
