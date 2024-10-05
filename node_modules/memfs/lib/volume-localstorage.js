"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectStore = void 0;
exports.createVolume = createVolume;
const volume_1 = require("./volume");
const node_1 = require("./node");
class ObjectStore {
    constructor(obj) {
        this.obj = obj;
    }
    setItem(key, json) {
        this.obj[key] = JSON.stringify(json);
    }
    getItem(key) {
        const data = this.obj[key];
        if (typeof data === void 0)
            return void 0;
        return JSON.parse(data);
    }
    removeItem(key) {
        delete this.obj[key];
    }
}
exports.ObjectStore = ObjectStore;
function createVolume(namespace, LS = localStorage) {
    const store = new ObjectStore(LS);
    const key = (type, id) => `memfs.${namespace}.${type}.${id}`;
    class NodeLocalStorage extends node_1.Node {
        get Key() {
            if (!this._key)
                this._key = key('ino', this.ino);
            return this._key;
        }
        sync() {
            store.setItem(this.Key, this.toJSON());
        }
        touch() {
            super.touch();
            this.sync();
        }
        del() {
            super.del();
            store.removeItem(this.Key);
        }
    }
    class LinkLocalStorage extends node_1.Link {
        get Key() {
            if (!this._key)
                this._key = key('link', this.getPath());
            return this._key;
        }
        sync() {
            store.setItem(this.Key, this.toJSON());
        }
    }
    return class VolumeLocalStorage extends volume_1.Volume {
        constructor() {
            super({
                Node: NodeLocalStorage,
                Link: LinkLocalStorage,
            });
        }
        createLink(parent, name, isDirectory, perm) {
            const link = super.createLink(parent, name, isDirectory, perm);
            store.setItem(key('link', link.getPath()), link.toJSON());
            return link;
        }
        deleteLink(link) {
            store.removeItem(key('link', link.getPath()));
            return super.deleteLink(link);
        }
    };
}
//# sourceMappingURL=volume-localstorage.js.map