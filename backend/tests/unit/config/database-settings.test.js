const {
    resolveDatabaseSettings,
    parseDatabaseUrl,
} = require('../../../config/database-settings');

describe('database-settings', () => {
    describe('resolveDatabaseSettings', () => {
        it('defaults to sqlite with the given file', () => {
            const settings = resolveDatabaseSettings({}, '/tmp/x.sqlite3');
            expect(settings).toEqual({
                dialect: 'sqlite',
                storage: '/tmp/x.sqlite3',
            });
        });

        it('selects postgres from DATABASE_URL', () => {
            const settings = resolveDatabaseSettings(
                {
                    DATABASE_URL:
                        'postgres://alice:s%40cret@db.example.com:5433/tududi_prod',
                },
                '/tmp/x.sqlite3'
            );
            expect(settings).toMatchObject({
                dialect: 'postgres',
                host: 'db.example.com',
                port: 5433,
                database: 'tududi_prod',
                username: 'alice',
                password: 's@cret',
                ssl: false,
                poolMax: 10,
            });
        });

        it('selects postgres from DB_DIALECT and discrete variables', () => {
            const settings = resolveDatabaseSettings(
                {
                    DB_DIALECT: 'postgres',
                    DB_HOST: 'pg',
                    DB_PORT: '6543',
                    DB_NAME: 'app',
                    DB_USER: 'u',
                    DB_PASSWORD: 'p',
                    DB_POOL_MAX: '25',
                },
                null
            );
            expect(settings).toMatchObject({
                dialect: 'postgres',
                host: 'pg',
                port: 6543,
                database: 'app',
                username: 'u',
                password: 'p',
                poolMax: 25,
            });
        });

        it('accepts postgresql as an alias for DB_DIALECT', () => {
            expect(
                resolveDatabaseSettings({ DB_DIALECT: 'PostgreSQL' }, null)
                    .dialect
            ).toBe('postgres');
        });

        it('lets discrete variables override parts of DATABASE_URL', () => {
            const settings = resolveDatabaseSettings(
                {
                    DATABASE_URL: 'postgres://u:p@host/db',
                    DB_NAME: 'other',
                },
                null
            );
            expect(settings.database).toBe('other');
            expect(settings.host).toBe('host');
            expect(settings.port).toBe(5432);
        });

        it('enables ssl from DB_SSL or sslmode in the URL, verifying certificates by default', () => {
            expect(
                resolveDatabaseSettings(
                    { DATABASE_URL: 'postgres://u:p@h/db', DB_SSL: 'true' },
                    null
                ).ssl
            ).toEqual({ rejectUnauthorized: true });
            expect(
                resolveDatabaseSettings(
                    {
                        DATABASE_URL: 'postgres://u:p@h/db?sslmode=require',
                        DB_SSL_REJECT_UNAUTHORIZED: 'false',
                    },
                    null
                ).ssl
            ).toEqual({ rejectUnauthorized: false });
            expect(
                resolveDatabaseSettings(
                    { DATABASE_URL: 'postgres://u:p@h/db?sslmode=disable' },
                    null
                ).ssl
            ).toBe(false);
        });

        it('falls back to the default pool size on bad input', () => {
            expect(
                resolveDatabaseSettings(
                    { DB_DIALECT: 'postgres', DB_POOL_MAX: 'lots' },
                    null
                ).poolMax
            ).toBe(10);
        });

        it('rejects unsupported dialects', () => {
            expect(() =>
                resolveDatabaseSettings({ DB_DIALECT: 'mysql' }, null)
            ).toThrow(/Unsupported DB_DIALECT/);
        });
    });

    describe('parseDatabaseUrl', () => {
        it('rejects non-postgres schemes', () => {
            expect(() => parseDatabaseUrl('mysql://u:p@h/db')).toThrow(
                /postgres:\/\/ scheme/
            );
        });

        it('rejects malformed urls', () => {
            expect(() => parseDatabaseUrl('not a url')).toThrow(
                /not a valid URL/
            );
        });

        it('fills defaults for missing host and port', () => {
            expect(parseDatabaseUrl('postgresql:///db')).toMatchObject({
                host: 'localhost',
                port: 5432,
                database: 'db',
            });
        });
    });
});
