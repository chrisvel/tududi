"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToLocation = void 0;
const hashToLocation = (hash) => {
    if (hash.length < 20)
        throw new TypeError('Hash is too short');
    const lastTwo = hash.slice(-2);
    const twoBeforeLastTwo = hash.slice(-4, -2);
    const folder = [lastTwo, twoBeforeLastTwo];
    return [folder, hash];
};
exports.hashToLocation = hashToLocation;
//# sourceMappingURL=util.js.map