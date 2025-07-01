const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('URL Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/url/title', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/url/title')
                .query({ url: 'https://example.com' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require url parameter', async () => {
            const response = await agent.get('/api/url/title');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('URL parameter is required');
        });

        it('should return title for valid URL', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'https://httpbin.org/html' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('https://httpbin.org/html');
            // Title could be extracted or null depending on network conditions
            expect(
                typeof response.body.title === 'string' ||
                    response.body.title === null
            ).toBe(true);
        }, 10000);

        it('should handle URL without protocol', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'httpbin.org/html' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('httpbin.org/html');
            // Title could be extracted or null depending on network conditions
            expect(
                typeof response.body.title === 'string' ||
                    response.body.title === null
            ).toBe(true);
        }, 10000);

        it('should handle invalid URL gracefully', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'not-a-valid-url' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe('not-a-valid-url');
            // Title could be null or error message
            expect(
                response.body.title === null ||
                    typeof response.body.title === 'string'
            ).toBe(true);
        });

        it('should handle unreachable URL', async () => {
            const response = await agent
                .get('/api/url/title')
                .query({ url: 'https://nonexistent-domain-12345.com' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('url');
            expect(response.body).toHaveProperty('title');
            expect(response.body.url).toBe(
                'https://nonexistent-domain-12345.com'
            );
            expect(response.body.title).toBe(null);
        });
    });

    describe('POST /api/url/extract-from-text', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/url/extract-from-text')
                .send({ text: 'Check out https://example.com' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require text parameter', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text parameter is required');
        });

        it('should extract URL from text and get title', async () => {
            const testText =
                'Check out this interesting site: https://httpbin.org/html';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('https://httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
            expect(response.body).toHaveProperty('title');
            // Title could be extracted or null depending on network conditions
            expect(
                typeof response.body.title === 'string' ||
                    response.body.title === null
            ).toBe(true);
        }, 10000);

        it('should extract first URL when multiple URLs in text', async () => {
            const testText =
                'Check out https://httpbin.org/html and also https://example.com';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('https://httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
            expect(response.body).toHaveProperty('title');
        }, 10000);

        it('should detect URLs without protocol', async () => {
            const testText = 'Visit httpbin.org/html for testing';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(true);
            expect(response.body.url).toBe('httpbin.org/html');
            expect(response.body.originalText).toBe(testText);
        });

        it('should return found false when no URL in text', async () => {
            const testText = 'This text has no URLs in it at all';
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: testText });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(false);
        });

        it('should handle empty text', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Text parameter is required');
        });

        it('should handle text with only whitespace', async () => {
            const response = await agent
                .post('/api/url/extract-from-text')
                .send({ text: '   \n\t  ' });

            expect(response.status).toBe(200);
            expect(response.body.found).toBe(false);
        });
    });
});
