const request = require('supertest');
const app = require('../../app');

describe('Security headers', () => {
    it('CSP frame-src allows same-origin frames for the PDF attachment preview', async () => {
        const res = await request(app).get('/api/health');
        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();
        const frameSrc = csp
            .split(';')
            .map((d) => d.trim())
            .find((d) => d.startsWith('frame-src '));
        expect(frameSrc).toBeDefined();
        expect(frameSrc.split(/\s+/)).toContain("'self'");
    });
});
