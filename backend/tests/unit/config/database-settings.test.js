const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    resolveDatabaseSettings,
    parseDatabaseUrl,
} = require('../../../config/database-settings');

describe('database-settings', () => {
    describe('resolveDatabaseSettings', () => {
        it('refuses to start without a database', () => {
            expect(() => resolveDatabaseSettings({})).toThrow(
                /No database configured/
            );
        });

        it('rejects DB_DIALECT=sqlite with a pointer to the move guide', () => {
            expect(() =>
                resolveDatabaseSettings({
                    DB_DIALECT: 'sqlite',
                    DATABASE_URL: 'postgres://u:p@h/db',
                })
            ).toThrow(/PostgreSQL only.*30-moving-to-postgres/);
        });

        it('selects postgres from DATABASE_URL', () => {
            const settings = resolveDatabaseSettings({
                DATABASE_URL:
                    'postgres://alice:s%40cret@db.example.com:5433/tududi_prod',
            });
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

        it('reads discrete variables', () => {
            const settings = resolveDatabaseSettings({
                DB_HOST: 'pg',
                DB_PORT: '6543',
                DB_NAME: 'app',
                DB_USER: 'u',
                DB_PASSWORD: 'p',
                DB_POOL_MAX: '25',
            });
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

        it('still accepts a leftover DB_DIALECT=postgresql', () => {
            expect(
                resolveDatabaseSettings({
                    DB_DIALECT: 'PostgreSQL',
                    DB_HOST: 'pg',
                }).dialect
            ).toBe('postgres');
        });

        it('lets discrete variables override parts of DATABASE_URL', () => {
            const settings = resolveDatabaseSettings({
                DATABASE_URL: 'postgres://u:p@host/db',
                DB_NAME: 'other',
            });
            expect(settings.database).toBe('other');
            expect(settings.host).toBe('host');
            expect(settings.port).toBe(5432);
        });

        it('enables ssl from DB_SSL or sslmode in the URL, verifying certificates by default', () => {
            expect(
                resolveDatabaseSettings({
                    DATABASE_URL: 'postgres://u:p@h/db',
                    DB_SSL: 'true',
                }).ssl
            ).toEqual({ rejectUnauthorized: true });
            expect(
                resolveDatabaseSettings({
                    DATABASE_URL: 'postgres://u:p@h/db?sslmode=require',
                    DB_SSL_REJECT_UNAUTHORIZED: 'false',
                }).ssl
            ).toEqual({ rejectUnauthorized: false });
            expect(
                resolveDatabaseSettings({
                    DATABASE_URL: 'postgres://u:p@h/db?sslmode=disable',
                }).ssl
            ).toBe(false);
        });

        it('loads client certificates from DATABASE_URL for mTLS', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-mtls-'));
            for (const name of ['ca', 'cert', 'key']) {
                fs.writeFileSync(path.join(dir, name), name.toUpperCase());
            }
            expect(
                resolveDatabaseSettings({
                    DATABASE_URL: `postgres://u@h/db?sslmode=verify-full&sslrootcert=${dir}/ca&sslcert=${dir}/cert&sslkey=${dir}/key`,
                    DB_SSL_REJECT_UNAUTHORIZED: 'false',
                }).ssl
            ).toEqual({
                ca: 'CA',
                cert: 'CERT',
                key: 'KEY',
                rejectUnauthorized: false,
            });
        });

        it('falls back to the default pool size on bad input', () => {
            expect(
                resolveDatabaseSettings({ DB_HOST: 'pg', DB_POOL_MAX: 'lots' })
                    .poolMax
            ).toBe(10);
        });

        it('rejects other dialects', () => {
            expect(() =>
                resolveDatabaseSettings({ DB_DIALECT: 'mysql', DB_HOST: 'h' })
            ).toThrow(/no longer supported/);
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
