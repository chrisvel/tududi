// Life-to-Day (T-305): Idempotency-Key middleware (blueprint 13.5).
// A POST/PATCH carrying an Idempotency-Key header stores its first response
// per (user, key); a retry with the same key gets that response back without
// re-executing the handler, so offline replays and network retries never
// create duplicates. Keys are namespaced per user — another user's key is
// simply a different key. 5xx responses are not stored, so genuine server
// errors stay retryable.
const repository = require('./repository');

const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 255;

// cheap printable-characters guard (header values are latin-1 by spec)
const KEY_PATTERN = /^[\x21-\x7e]+$/;

function getUserId(req) {
    return req.currentUser?.id ?? req.user?.id ?? null;
}

async function idempotencyMiddleware(req, res, next) {
    try {
        if (req.method !== 'POST' && req.method !== 'PATCH') {
            return next();
        }

        const key = req.get(HEADER);
        if (!key) {
            return next();
        }

        if (key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(key)) {
            return res
                .status(400)
                .json({ error: 'Invalid Idempotency-Key header.' });
        }

        const userId = getUserId(req);
        if (!userId) {
            return next();
        }

        const existing = await repository.findByKeyAndUser(key, userId);
        if (existing) {
            res.set('Idempotency-Replayed', 'true');
            res.status(existing.status);
            res.type('application/json');
            return res.send(existing.response);
        }

        // Capture the first response and store it for future replays.
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            const status = res.statusCode;
            if (status < 500) {
                repository
                    .saveResult({
                        key,
                        userId,
                        method: req.method,
                        path: req.baseUrl + req.path,
                        status,
                        response: body,
                    })
                    .then(() => repository.purgeExpired())
                    .catch((error) => {
                        // Storage failure must not break the request itself.
                        console.error(
                            '[ltd-idempotency] failed to store key:',
                            error.message
                        );
                    });
            }
            return originalJson(body);
        };

        next();
    } catch (error) {
        next(error);
    }
}

module.exports = { idempotencyMiddleware };
