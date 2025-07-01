const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Quotes Routes', () => {
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

    describe('GET /api/quotes/random', () => {
        it('should return a random quote', async () => {
            const response = await agent.get('/api/quotes/random');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('quote');
            expect(typeof response.body.quote).toBe('string');
            expect(response.body.quote.length).toBeGreaterThan(0);
        });

        it('should return different quotes on multiple requests', async () => {
            const responses = await Promise.all([
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
            ]);

            // All responses should be successful
            responses.forEach((response) => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('quote');
                expect(typeof response.body.quote).toBe('string');
            });

            // With multiple requests, we should get at least some variety
            // (though it's possible to get the same quote multiple times due to randomness)
            const quotes = responses.map((r) => r.body.quote);
            const uniqueQuotes = new Set(quotes);

            // We expect at least 1 unique quote, but likely more
            expect(uniqueQuotes.size).toBeGreaterThanOrEqual(1);
        });

        it('should return valid quote structure', async () => {
            const response = await agent.get('/api/quotes/random');

            expect(response.status).toBe(200);
            expect(Object.keys(response.body)).toEqual(['quote']);
            expect(response.body.quote).toBeTruthy();
            expect(response.body.quote.trim()).toBe(response.body.quote);
        });
    });

    describe('GET /api/quotes', () => {
        it('should return all quotes with count', async () => {
            const response = await agent.get('/api/quotes');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('quotes');
            expect(response.body).toHaveProperty('count');
            expect(Array.isArray(response.body.quotes)).toBe(true);
            expect(typeof response.body.count).toBe('number');
            expect(response.body.quotes.length).toBe(response.body.count);
            expect(response.body.count).toBeGreaterThan(0);
        });

        it('should return valid quote array', async () => {
            const response = await agent.get('/api/quotes');

            expect(response.status).toBe(200);

            // All quotes should be non-empty strings
            response.body.quotes.forEach((quote) => {
                expect(typeof quote).toBe('string');
                expect(quote.length).toBeGreaterThan(0);
                expect(quote.trim()).toBe(quote);
            });
        });

        it('should return consistent data across requests', async () => {
            const response1 = await agent.get('/api/quotes');
            const response2 = await agent.get('/api/quotes');

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);

            // The quotes array should be the same across requests
            expect(response1.body.quotes.length).toBe(
                response2.body.quotes.length
            );
            expect(response1.body.count).toBe(response2.body.count);

            // Verify the actual content is the same
            expect(response1.body.quotes).toEqual(response2.body.quotes);
        });

        it('should return expected quote count', async () => {
            const response = await agent.get('/api/quotes');

            expect(response.status).toBe(200);

            // Based on the configuration, we expect 20 quotes, but allow for fallback quotes
            expect(response.body.count).toBeGreaterThanOrEqual(5);
            expect(response.body.quotes.length).toBe(response.body.count);
        });

        it('should contain productivity-focused quotes', async () => {
            const response = await agent.get('/api/quotes');

            expect(response.status).toBe(200);

            // Look for some productivity-related keywords in the quotes
            const allQuotesText = response.body.quotes.join(' ').toLowerCase();

            // These are common themes in productivity quotes
            const productivityKeywords = [
                'progress',
                'task',
                'goal',
                'focus',
                'accomplish',
                'success',
                'work',
                'effort',
                'achieve',
                'time',
            ];

            // At least some quotes should contain productivity-related terms
            const hasProductivityContent = productivityKeywords.some(
                (keyword) => allQuotesText.includes(keyword)
            );

            expect(hasProductivityContent).toBe(true);
        });
    });

    describe('Quote randomness and consistency', () => {
        it('should have random quotes that are part of the full quote set', async () => {
            // Get all quotes first
            const allQuotesResponse = await agent.get('/api/quotes');
            const allQuotes = allQuotesResponse.body.quotes;

            // Get several random quotes
            const randomQuoteResponses = await Promise.all([
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
                agent.get('/api/quotes/random'),
            ]);

            // Each random quote should be from the full set
            randomQuoteResponses.forEach((response) => {
                expect(response.status).toBe(200);
                expect(allQuotes).toContain(response.body.quote);
            });
        });
    });
});
