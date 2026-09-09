const request = require('supertest');
const app = require('../../app');

describe('Security headers', () => {
    it('allows the app to frame its own resources (PDF attachment preview)', async () => {
        const res = await request(app).get('/api/health');
        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();

        const frameSrc = csp
            .split(';')
            .map((directive) => directive.trim())
            .find((directive) => directive.startsWith('frame-src'));

        expect(frameSrc).toBeDefined();
        expect(frameSrc).toContain("'self'");
        expect(frameSrc).toContain('https://challenges.cloudflare.com');
    });

    it('permits same-origin framing via X-Frame-Options', async () => {
        const res = await request(app).get('/api/health');
        const xfo = (
            res.headers['x-frame-options'] || 'SAMEORIGIN'
        ).toUpperCase();
        expect(xfo).not.toBe('DENY');
        expect(xfo).toBe('SAMEORIGIN');
    });
});
