const http = require('http');
const https = require('https');

// Mock modules - must be before require
const mockDnsLookup = jest.fn();
jest.mock('dns', () => {
    const actualDns = jest.requireActual('dns');
    return {
        ...actualDns,
        promises: {
            ...actualDns.promises,
            lookup: mockDnsLookup,
        },
    };
});

const icsFetcher = require('../../../modules/calendar/icsFetcher');

describe('icsFetcher SSRF Protection', () => {
    let mockServer;
    let mockServerPort;

    beforeAll((done) => {
        mockServer = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/calendar' });
            res.end('BEGIN:VCALENDAR\nEND:VCALENDAR');
        });
        mockServer.listen(0, () => {
            mockServerPort = mockServer.address().port;
            done();
        });
    });

    afterAll((done) => {
        if (mockServer) {
            mockServer.close(done);
        } else {
            done();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateUrl', () => {
        it('should reject localhost hostname', async () => {
            const result = await icsFetcher.fetchIcs(
                'http://localhost/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should reject 127.0.0.1', async () => {
            const result = await icsFetcher.fetchIcs(
                'http://127.0.0.1/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should reject 127.0.0.2', async () => {
            const result = await icsFetcher.fetchIcs(
                'http://127.0.0.2/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should reject 0.0.0.0', async () => {
            const result = await icsFetcher.fetchIcs(
                'http://0.0.0.0/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });
    });

    describe('DNS resolution SSRF protection', () => {
        it('should block 10.0.0.0/8 private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '10.0.0.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 10.255.255.255 in private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '10.255.255.255', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 172.16.0.0/12 private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '172.16.0.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 172.31.255.254 in private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '172.31.255.254', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 192.168.0.0/16 private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '192.168.1.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 192.168.255.255 in private range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '192.168.255.255', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 169.254.0.0/16 link-local range', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '169.254.1.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block 169.254.169.254 (AWS metadata)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '169.254.169.254', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://metadata.aws.com/latest/meta-data/'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block ::1 (IPv6 localhost)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '::1', family: 6 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://localhost6.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block fc00::/7 (IPv6 unique local)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: 'fc00::1', family: 6 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://internal6.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block fe80::/10 (IPv6 link-local)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: 'fe80::1', family: 6 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://local6.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block IPv4-mapped IPv6 addresses (::ffff:127.0.0.1)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '::ffff:127.0.0.1', family: 6 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://mapped.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block IPv4-mapped private addresses (::ffff:192.168.1.1)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '::ffff:192.168.1.1', family: 6 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://mapped.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should allow public IPv4 address', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '8.8.8.8', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://public.example.com/calendar.ics',
                { timeoutMs: 100 }
            );

            expect(result.success).toBe(false);
            expect(result.error).not.toContain('blocked');
        });

        it('should allow public IPv4 address (1.1.1.1)', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '1.1.1.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://public2.example.com/calendar.ics',
                { timeoutMs: 100 }
            );

            expect(result.success).toBe(false);
            expect(result.error).not.toContain('blocked');
        });

        it('should handle DNS lookup failure', async () => {
            mockDnsLookup.mockRejectedValueOnce(new Error('ENOTFOUND'));

            const result = await icsFetcher.fetchIcs(
                'http://nonexistent.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should handle empty DNS response', async () => {
            mockDnsLookup.mockResolvedValueOnce([]);

            const result = await icsFetcher.fetchIcs(
                'http://empty.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should handle null DNS response', async () => {
            mockDnsLookup.mockResolvedValueOnce(null);

            const result = await icsFetcher.fetchIcs(
                'http://null.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });
    });

    describe('URL edge cases', () => {
        it('should reject invalid URL format', async () => {
            const result = await icsFetcher.fetchIcs('not-a-valid-url');
            expect(result.success).toBe(false);
        });

        it('should reject empty URL', async () => {
            const result = await icsFetcher.fetchIcs('');
            expect(result.success).toBe(false);
        });

        it('should reject null URL', async () => {
            const result = await icsFetcher.fetchIcs(null);
            expect(result.success).toBe(false);
        });

        it('should reject undefined URL', async () => {
            const result = await icsFetcher.fetchIcs(undefined);
            expect(result.success).toBe(false);
        });

        it('should handle URL with authentication', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '8.8.8.8', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://user:pass@example.com/calendar.ics',
                { timeoutMs: 100 }
            );

            expect(result.success).toBe(false);
            expect(result.error).not.toContain('blocked');
        });
    });

    describe('Multiple DNS addresses', () => {
        it('should block if ANY resolved address is private', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '8.8.8.8', family: 4 },
                { address: '192.168.1.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://mixed.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should block if second address is private', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '1.1.1.1', family: 4 },
                { address: '10.0.0.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://mixed2.example.com/calendar.ics'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('should allow if all resolved addresses are public', async () => {
            mockDnsLookup.mockResolvedValueOnce([
                { address: '8.8.8.8', family: 4 },
                { address: '1.1.1.1', family: 4 },
            ]);

            const result = await icsFetcher.fetchIcs(
                'http://multi.example.com/calendar.ics',
                { timeoutMs: 100 }
            );

            expect(result.success).toBe(false);
            expect(result.error).not.toContain('blocked');
        });
    });
});
