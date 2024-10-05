"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTree = void 0;
const printTree = (tab = '', children) => {
    children = children.filter(Boolean);
    let str = '';
    for (let i = 0; i < children.length; i++) {
        const isLast = i >= children.length - 1;
        const fn = children[i];
        if (!fn)
            continue;
        const child = fn(tab + `${isLast ? ' ' : '│'}  `);
        const branch = child ? (isLast ? '└─' : '├─') : '│ ';
        str += `\n${tab}${branch} ${child}`;
    }
    return str;
};
exports.printTree = printTree;
//# sourceMappingURL=printTree.js.map