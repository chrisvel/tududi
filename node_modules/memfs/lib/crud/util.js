"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertType = void 0;
const util_1 = require("../node-to-fsa/util");
const assertType = (type, method, klass) => {
    const length = type.length;
    for (let i = 0; i < length; i++)
        (0, util_1.assertName)(type[i], method, klass);
};
exports.assertType = assertType;
//# sourceMappingURL=util.js.map