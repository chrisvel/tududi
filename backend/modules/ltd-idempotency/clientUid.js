// Life-to-Day (T-305): validation for client-supplied uids (blueprint 13.5).
// Matches backend/utils/uid.js exactly: alphabet
// 0123456789abcdefghijkmnpqrstuvwxyz (no l, no o), length 15.
const CLIENT_UID_PATTERN = /^[0-9abcdefghijkmnpqrstuvwxyz]{15}$/;

function isValidClientUid(uid) {
    return typeof uid === 'string' && CLIENT_UID_PATTERN.test(uid);
}

module.exports = { isValidClientUid, CLIENT_UID_PATTERN };
