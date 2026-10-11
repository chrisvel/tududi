// Life-to-Day (T-305): offline identity — Idempotency-Key middleware and
// client-uid validation for exactly-once task creation.
const { idempotencyMiddleware } = require('./middleware');
const { isValidClientUid } = require('./clientUid');
const repository = require('./repository');

module.exports = {
    idempotencyMiddleware,
    isValidClientUid,
    repository,
};
