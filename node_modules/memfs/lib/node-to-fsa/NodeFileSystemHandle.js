"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFileSystemHandle = void 0;
/**
 * Represents a File System Access API file handle `FileSystemHandle` object,
 * which was created from a Node.js `fs` module.
 *
 * @see [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle)
 */
class NodeFileSystemHandle {
    constructor(kind, name) {
        this.kind = kind;
        this.name = name;
    }
    /**
     * Compares two handles to see if the associated entries (either a file or directory) match.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/isSameEntry
     */
    isSameEntry(fileSystemHandle) {
        return (this.constructor === fileSystemHandle.constructor && this.__path === fileSystemHandle.__path);
    }
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission
     */
    queryPermission(fileSystemHandlePermissionDescriptor) {
        throw new Error('Not implemented');
    }
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/remove
     */
    async remove({ recursive } = { recursive: false }) {
        throw new Error('Not implemented');
    }
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
     */
    requestPermission(fileSystemHandlePermissionDescriptor) {
        throw new Error('Not implemented');
    }
}
exports.NodeFileSystemHandle = NodeFileSystemHandle;
//# sourceMappingURL=NodeFileSystemHandle.js.map