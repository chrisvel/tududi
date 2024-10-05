"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concurrency = void 0;
const tslib_1 = require("tslib");
const concurrency_1 = require("./concurrency");
const instances = new WeakMap();
/**
 * A class method decorator that limits the concurrency of the method to the
 * given number of parallel executions. All invocations are queued and executed
 * in the order they were called.
 */
function concurrency(limit) {
    return (fn, context) => {
        return function (...args) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                let map = instances.get(this);
                if (!map)
                    instances.set(this, (map = new WeakMap()));
                if (!map.has(fn))
                    map.set(fn, (0, concurrency_1.concurrency)(limit));
                return map.get(fn)(() => tslib_1.__awaiter(this, void 0, void 0, function* () { return yield fn.call(this, ...args); }));
            });
        };
    };
}
exports.concurrency = concurrency;
