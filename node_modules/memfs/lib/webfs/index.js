"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
self.process = require('process/browser');
const fsa_to_node_1 = require("../fsa-to-node");
const FsaNodeSyncWorker_1 = require("../../src/fsa-to-node/worker/FsaNodeSyncWorker");
if (typeof window === 'object') {
    const url = document.currentScript.src;
    const dir = navigator.storage.getDirectory();
    const fs = (window.fs = new fsa_to_node_1.FsaNodeFs(dir));
    if (url) {
        fsa_to_node_1.FsaNodeSyncAdapterWorker.start(url, dir)
            .then(adapter => {
            fs.syncAdapter = adapter;
        })
            .catch(() => { });
    }
}
else {
    const worker = new FsaNodeSyncWorker_1.FsaNodeSyncWorker();
    worker.start();
}
//# sourceMappingURL=index.js.map