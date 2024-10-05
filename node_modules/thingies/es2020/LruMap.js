"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LruMap = void 0;
class LruMap extends Map {
    constructor(limit = Infinity) {
        super();
        this.limit = limit;
    }
    set(key, value) {
        super.set(key, value);
        if (this.size > this.limit)
            this.delete(super.keys().next().value);
        return this;
    }
    get(key) {
        if (!super.has(key))
            return undefined;
        const value = super.get(key);
        super.delete(key);
        super.set(key, value);
        return value;
    }
}
exports.LruMap = LruMap;
