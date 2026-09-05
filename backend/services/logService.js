const pino = require('pino');

// One structured logger for the backend. JSON lines in production (what a
// log shipper wants), pretty output in development, silent in tests unless
// LOG_LEVEL says otherwise. LOG_FORMAT=json|pretty overrides the default.
const environment = process.env.NODE_ENV || 'development';

const level =
    process.env.LOG_LEVEL || (environment === 'test' ? 'silent' : 'info');

const format =
    process.env.LOG_FORMAT ||
    (environment === 'development' ? 'pretty' : 'json');

const REDACT = [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'password_digest',
    'token',
    'telegram_bot_token',
];

function buildLogger() {
    const options = { level, redact: { paths: REDACT, censor: '[redacted]' } };
    if (format === 'pretty') {
        try {
            options.transport = {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
            };
        } catch (_) {
            // pino-pretty is a dev dependency; fall back to JSON without it
        }
    }
    return pino(options);
}

const logger = buildLogger();

// Existing call sites pass (message, error) or (error, message) or a
// single value. Normalise to pino's (object, message) shape so the error
// stack lands in the JSON instead of being stringified.
function splitArgs(args) {
    const errors = args.filter((a) => a instanceof Error);
    const rest = args.filter((a) => !(a instanceof Error));
    const message = rest
        .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
        .join(' ');
    return { err: errors[0], message };
}

function safeStringify(value) {
    try {
        return JSON.stringify(value);
    } catch (_) {
        return String(value);
    }
}

const logError = (...args) => {
    const { err, message } = splitArgs(args);
    if (err) logger.error({ err }, message || err.message);
    else logger.error(message);
};

const logInfo = (...args) => {
    const { err, message } = splitArgs(args);
    if (err) logger.info({ err }, message || err.message);
    else logger.info(message);
};

const logDebug = (...args) => {
    const { err, message } = splitArgs(args);
    if (err) logger.debug({ err }, message || err.message);
    else logger.debug(message);
};

module.exports = {
    logger,
    logError,
    logInfo,
    logDebug,
};
