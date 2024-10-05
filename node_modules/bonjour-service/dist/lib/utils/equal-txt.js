"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function equalTxt(a, b) {
    if (a === undefined || b === undefined)
        return false;
    let aKeys = Object.keys(a);
    let bKeys = Object.keys(b);
    if (aKeys.length != bKeys.length)
        return false;
    for (let key of aKeys) {
        if (a[key] != b[key])
            return false;
    }
    return true;
}
exports.default = equalTxt;
//# sourceMappingURL=equal-txt.js.map