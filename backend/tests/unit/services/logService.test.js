const axios = require('axios');
const { Writable } = require('stream');
const {
    logger,
    buildLogger,
    serializeError,
    stripQuery,
    logError,
    logInfo,
    logDebug,
} = require('../../../services/logService');

const captureLogs = () => {
    const lines = [];
    const destination = new Writable({
        write(chunk, _encoding, callback) {
            lines.push(chunk.toString());
            callback();
        },
    });
    const capturing = buildLogger({ destination, logLevel: 'error' });
    return { logger: capturing, output: () => lines.join('') };
};

describe('logService', () => {
    it('exposes a pino logger plus the legacy helpers', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.child).toBe('function');
        expect(typeof logError).toBe('function');
        expect(typeof logInfo).toBe('function');
        expect(typeof logDebug).toBe('function');
    });

    it('accepts every argument shape the code base uses', () => {
        const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
        const err = new Error('boom');

        logError('Something failed:', err);
        logError(err, 'Context first');
        logError('Just a message');
        logError({ id: 3 }, 'with an object');

        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls[0][0]).toEqual({ err });
        expect(spy.mock.calls[0][1]).toBe('Something failed:');
        expect(spy.mock.calls[1][0]).toEqual({ err });
        expect(spy.mock.calls[1][1]).toBe('Context first');
        expect(spy.mock.calls[2][0]).toBe('Just a message');
        expect(spy.mock.calls[3][0]).toBe('{"id":3} with an object');
        spy.mockRestore();
    });

    it('never throws on unserialisable values', () => {
        const circular = {};
        circular.self = circular;
        expect(() => logInfo('circular', circular)).not.toThrow();
        expect(() => logDebug(undefined)).not.toThrow();
    });

    it('does not write axios request credentials to the log', async () => {
        const { logger: capturing, output } = captureLogs();

        let error;
        try {
            await axios.get('http://127.0.0.1:1/calendar', {
                auth: { username: 'calendar-user', password: 'SECRETPW-123' },
                headers: { 'X-Api-Key': 'SECRET-API-KEY' },
                timeout: 1000,
            });
        } catch (err) {
            error = err;
        }
        expect(error).toBeDefined();

        capturing.error({ err: error }, 'CalDAV sync failed');

        const written = output();
        const basic = Buffer.from('calendar-user:SECRETPW-123').toString(
            'base64'
        );
        expect(written).not.toContain('SECRETPW-123');
        expect(written).not.toContain(basic);
        expect(written).not.toContain('SECRET-API-KEY');
        expect(written).toContain('CalDAV sync failed');
        expect(written).toContain('ECONNREFUSED');
    });

    it('drops the SQL and bound parameters from database errors', () => {
        const { logger: capturing, output } = captureLogs();

        const error = new Error('SQLITE_ERROR: no such column');
        error.name = 'SequelizeDatabaseError';
        error.sql = "UPDATE notes SET content = 'private note text'";
        error.parameters = { content: 'private note text' };
        error.original = { sql: 'private note text' };

        capturing.error({ err: error }, 'query failed');

        const written = output();
        expect(written).not.toContain('private note text');
        expect(written).toContain('SequelizeDatabaseError');
        expect(written).toContain('no such column');
    });

    it('keeps the fields needed to diagnose a failure', () => {
        const error = new Error('boom');
        error.code = 'ETIMEDOUT';
        error.response = { status: 502, data: { secret: 'x' } };

        const serialized = serializeError(error);

        expect(serialized).toMatchObject({
            type: 'Error',
            message: 'boom',
            code: 'ETIMEDOUT',
            status: 502,
        });
        expect(serialized.stack).toContain('boom');
        expect(serialized).not.toHaveProperty('response');
    });

    it('redacts nested credential fields on plain log objects', () => {
        const { logger: capturing, output } = captureLogs();

        capturing.error(
            {
                account: {
                    password: 'nested-pw',
                    ai_api_key: 'nested-key',
                    telegram_bot_token: 'nested-bot',
                },
            },
            'context'
        );

        const written = output();
        expect(written).not.toContain('nested-pw');
        expect(written).not.toContain('nested-key');
        expect(written).not.toContain('nested-bot');
    });

    it('removes the query string from request urls', () => {
        expect(stripQuery('/api/verify-email?token=abc123')).toBe(
            '/api/verify-email'
        );
        expect(stripQuery('/api/oidc/callback/google?code=c&state=s')).toBe(
            '/api/oidc/callback/google'
        );
        expect(stripQuery('/api/tasks')).toBe('/api/tasks');
    });
});
