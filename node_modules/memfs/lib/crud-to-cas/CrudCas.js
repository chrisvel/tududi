"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrudCas = void 0;
const util_1 = require("./util");
const CrudCasBase_1 = require("./CrudCasBase");
const hashEqual = (h1, h2) => h1 === h2;
class CrudCas extends CrudCasBase_1.CrudCasBase {
    constructor(crud, options) {
        super(crud, options.hash, util_1.hashToLocation, hashEqual);
        this.crud = crud;
        this.options = options;
    }
}
exports.CrudCas = CrudCas;
//# sourceMappingURL=CrudCas.js.map