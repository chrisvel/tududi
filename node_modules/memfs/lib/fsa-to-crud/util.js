"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newMissingError = exports.newExistsError = exports.newFolder404Error = exports.newFile404Error = void 0;
const newFile404Error = (collection, id) => new DOMException(`Resource "${id}" in /${collection.join('/')} not found`, 'ResourceNotFound');
exports.newFile404Error = newFile404Error;
const newFolder404Error = (collection) => new DOMException(`Collection /${collection.join('/')} does not exist`, 'CollectionNotFound');
exports.newFolder404Error = newFolder404Error;
const newExistsError = () => new DOMException('Resource already exists', 'Exists');
exports.newExistsError = newExistsError;
const newMissingError = () => new DOMException('Resource is missing', 'Missing');
exports.newMissingError = newMissingError;
//# sourceMappingURL=util.js.map