'use strict';

// Life-to-Day (T-701, T-707): blueprint 17.3 over real HTTP, offline. The
// check runs in a child process (tests/helpers/ltdOauthContract.js) because
// Jest stubs jose and cannot import the ESM oidc-provider.
const path = require('path');
const { execFileSync } = require('child_process');

describe('embedded OAuth server contract (blueprint 17.3)', () => {
    it('passes every contract check against this code', () => {
        const output = execFileSync(
            process.execPath,
            [path.join(__dirname, '../helpers/ltdOauthContract.js')],
            { env: { ...process.env }, encoding: 'utf8', timeout: 120000 }
        );
        const line = output.split('\n').find((l) => l.startsWith('RESULT '));
        expect(line).toBeDefined();
        const results = JSON.parse(line.slice('RESULT '.length));
        expect(results.length).toBeGreaterThanOrEqual(40);
        expect(results.filter((r) => !r.pass)).toEqual([]);
    }, 150000);
});
