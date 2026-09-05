const {
    logger,
    logError,
    logInfo,
    logDebug,
} = require('../../../services/logService');

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
});
