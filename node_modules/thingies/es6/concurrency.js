"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concurrency = void 0;
const tslib_1 = require("tslib");
const go_1 = require("./go");
/* tslint:disable */
class Task {
    constructor(code) {
        this.code = code;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}
/** Limits concurrency of async code. */
const concurrency = (limit) => {
    let workers = 0;
    const queue = new Set();
    const work = () => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
        const task = queue.values().next().value;
        if (task)
            queue.delete(task);
        else
            return;
        workers++;
        try {
            task.resolve(yield task.code());
        }
        catch (error) {
            task.reject(error);
        }
        finally {
            workers--, queue.size && (0, go_1.go)(work);
        }
    });
    return (code) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
        const task = new Task(code);
        queue.add(task);
        return workers < limit && (0, go_1.go)(work), task.promise;
    });
};
exports.concurrency = concurrency;
