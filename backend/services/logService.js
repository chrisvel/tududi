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
    'password_encrypted',
    'token',
    'telegram_bot_token',
    'ai_api_key',
    '*.password',
    '*.password_digest',
    '*.password_encrypted',
    '*.token',
    '*.telegram_bot_token',
    '*.ai_api_key',
];

// pino's default error serializer copies every enumerable property of the
// error. For an axios failure that includes config.auth.password and the
// outgoing Authorization header, and for a Sequelize error it includes the
// SQL and its bound parameters (note text, task names, password digests).
// Only the fields needed to diagnose the failure are kept.
function serializeError(err) {
    if (!(err instanceof Error)) return err;

    const serialized = {
        type: err.name || err.constructor?.name || 'Error',
        message: err.message,
        stack: err.stack,
    };
    if (err.code) serialized.code = err.code;
    if (err.errno) serialized.errno = err.errno;
    if (err.syscall) serialized.syscall = err.syscall;
    const status = err.response?.status || err.status;
    if (status) serialized.status = status;
    if (err.cause instanceof Error)
        serialized.cause = serializeError(err.cause);
    return serialized;
}

// Verification links, password reset links and OIDC callbacks carry secrets
// in the query string (token, code, state), so request logs keep the path only.
function stripQuery(url) {
    if (typeof url !== 'string') return url;
    const queryStart = url.indexOf('?');
    return queryStart === -1 ? url : url.slice(0, queryStart);
}

function buildLogger({ destination, logLevel = level } = {}) {
    const options = {
        level: logLevel,
        redact: { paths: REDACT, censor: '[redacted]' },
        serializers: { err: serializeError },
    };
    if (!destination && format === 'pretty') {
        try {
            options.transport = {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
            };
        } catch (_) {
            // pino-pretty is a dev dependency; fall back to JSON without it
        }
    }
    return destination ? pino(options, destination) : pino(options);
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
    buildLogger,
    serializeError,
    stripQuery,
    REDACT,
    logError,
    logInfo,
    logDebug,
};
