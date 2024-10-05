"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTreeSync = void 0;
const tree_dump_1 = require("tree-dump");
const util_1 = require("../node-to-fsa/util");
const toTreeSync = (fs, opts = {}) => {
    var _a;
    const separator = opts.separator || '/';
    let dir = opts.dir || separator;
    if (dir[dir.length - 1] !== separator)
        dir += separator;
    const tab = opts.tab || '';
    const depth = (_a = opts.depth) !== null && _a !== void 0 ? _a : 10;
    let subtree = ' (...)';
    if (depth > 0) {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        subtree = (0, tree_dump_1.printTree)(tab, list.map(entry => tab => {
            if (entry.isDirectory()) {
                return (0, exports.toTreeSync)(fs, { dir: dir + entry.name, depth: depth - 1, tab });
            }
            else if (entry.isSymbolicLink()) {
                return '' + entry.name + ' → ' + fs.readlinkSync(dir + entry.name);
            }
            else {
                return '' + entry.name;
            }
        }));
    }
    const base = (0, util_1.basename)(dir, separator) + separator;
    return base + subtree;
};
exports.toTreeSync = toTreeSync;
//# sourceMappingURL=index.js.map