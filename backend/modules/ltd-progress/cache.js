'use strict';

// Projections are disposable. Invalidate both before and after commit so a
// concurrent reader cannot repopulate a stale snapshot during a transaction.
const entries = new Map();
const TTL_MS = 5000;
let revision = 0;
function invalidate(userId) {
    revision++;
    if (userId === undefined) entries.clear();
    else entries.delete(userId);
}
function get(userId) {
    const entry = entries.get(userId);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
        entries.delete(userId);
        return null;
    }
    return entry.value;
}
function set(userId, value, readRevision = revision) {
    if (readRevision !== revision) return;
    if (entries.size >= 100) entries.delete(entries.keys().next().value);
    entries.set(userId, { value, expires: Date.now() + TTL_MS });
}
module.exports = { get, set, invalidate, revision: () => revision };
