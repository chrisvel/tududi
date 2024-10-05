"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.until = void 0;
const tslib_1 = require("tslib");
const tick_1 = require("./tick");
const until = (check_1, ...args_1) => tslib_1.__awaiter(void 0, [check_1, ...args_1], void 0, function* (check, pollInterval = 1) {
    do {
        if (yield check())
            return;
        yield (0, tick_1.tick)(pollInterval);
    } while (true);
});
exports.until = until;
