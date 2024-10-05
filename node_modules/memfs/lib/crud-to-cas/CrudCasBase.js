"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrudCasBase = void 0;
const normalizeErrors = async (code) => {
    try {
        return await code();
    }
    catch (error) {
        if (error && typeof error === 'object') {
            switch (error.name) {
                case 'ResourceNotFound':
                case 'CollectionNotFound':
                    throw new DOMException(error.message, 'BlobNotFound');
            }
        }
        throw error;
    }
};
class CrudCasBase {
    constructor(crud, hash, hash2Loc, hashEqual) {
        this.crud = crud;
        this.hash = hash;
        this.hash2Loc = hash2Loc;
        this.hashEqual = hashEqual;
        this.put = async (blob) => {
            const digest = await this.hash(blob);
            const [collection, resource] = this.hash2Loc(digest);
            await this.crud.put(collection, resource, blob);
            return digest;
        };
        this.get = async (hash, options) => {
            const [collection, resource] = this.hash2Loc(hash);
            return await normalizeErrors(async () => {
                const blob = await this.crud.get(collection, resource);
                if (!(options === null || options === void 0 ? void 0 : options.skipVerification)) {
                    const digest = await this.hash(blob);
                    if (!this.hashEqual(digest, hash))
                        throw new DOMException('Blob contents does not match hash', 'Integrity');
                }
                return blob;
            });
        };
        this.del = async (hash, silent) => {
            const [collection, resource] = this.hash2Loc(hash);
            await normalizeErrors(async () => {
                return await this.crud.del(collection, resource, silent);
            });
        };
        this.info = async (hash) => {
            const [collection, resource] = this.hash2Loc(hash);
            return await normalizeErrors(async () => {
                return await this.crud.info(collection, resource);
            });
        };
    }
}
exports.CrudCasBase = CrudCasBase;
//# sourceMappingURL=CrudCasBase.js.map