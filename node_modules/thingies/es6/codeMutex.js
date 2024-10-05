"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeMutex = void 0;
const tslib_1 = require("tslib");
/**
 * Executes only one instance of give code at a time. If other calls come in in
 * parallel, they get resolved to the result of the ongoing execution.
 */
const codeMutex = () => {
    let result;
    return (code) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
        if (result)
            return result;
        try {
            return yield (result = code());
        }
        finally {
            result = undefined;
        }
    });
};
exports.codeMutex = codeMutex;
