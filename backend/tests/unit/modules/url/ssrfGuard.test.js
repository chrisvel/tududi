const dns = require('dns');
const {
    assertSafeUrl,
    isPrivateOrReservedIp,
    UnsafeUrlError,
} = require('../../../../modules/url/ssrfGuard');

describe('ssrfGuard', () => {
    describe('isPrivateOrReservedIp', () => {
        it.each([
            ['127.0.0.1', true],
            ['127.5.5.5', true],
            ['10.0.0.1', true],
            ['172.16.0.1', true],
            ['172.31.255.255', true],
            ['192.168.1.1', true],
            ['169.254.169.254', true], // cloud metadata endpoint
            ['0.0.0.0', true],
            ['100.64.0.1', true], // CGNAT
            ['224.0.0.1', true], // multicast
            ['240.0.0.1', true], // reserved
            ['8.8.8.8', false],
            ['1.1.1.1', false],
            ['93.184.216.34', false],
        ])('treats IPv4 %s as private=%s', (ip, expected) => {
            expect(isPrivateOrReservedIp(ip)).toBe(expected);
        });

        it.each([
            ['::1', true],
            ['fc00::1', true],
            ['fd12:3456:789a::1', true],
            ['fe80::1', true],
            ['::ffff:127.0.0.1', true],
            ['::ffff:169.254.169.254', true],
            ['2001:4860:4860::8888', false],
        ])('treats IPv6 %s as private=%s', (ip, expected) => {
            expect(isPrivateOrReservedIp(ip)).toBe(expected);
        });
    });

    describe('assertSafeUrl', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('rejects non-http(s) protocols', async () => {
            await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(
                UnsafeUrlError
            );
        });

        it('rejects non-standard ports', async () => {
            await expect(
                assertSafeUrl('http://example.com:8080/')
            ).rejects.toThrow(UnsafeUrlError);
        });

        it('rejects IP-literal URLs pointing at private ranges', async () => {
            await expect(assertSafeUrl('http://192.168.1.1/')).rejects.toThrow(
                UnsafeUrlError
            );
        });

        it('rejects the cloud metadata endpoint', async () => {
            await expect(
                assertSafeUrl('http://169.254.169.254/latest/meta-data/')
            ).rejects.toThrow(UnsafeUrlError);
        });

        it('rejects loopback URLs', async () => {
            await expect(assertSafeUrl('http://127.0.0.1:80/')).rejects.toThrow(
                UnsafeUrlError
            );
        });

        it('rejects hostnames that resolve to a private address', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '10.0.0.5', family: 4 },
            ]);

            await expect(
                assertSafeUrl('http://internal.example.com/')
            ).rejects.toThrow(UnsafeUrlError);
        });

        it('rejects hostnames that fail to resolve', async () => {
            jest.spyOn(dns.promises, 'lookup').mockRejectedValue(
                new Error('ENOTFOUND')
            );

            await expect(
                assertSafeUrl('http://does-not-exist.example.com/')
            ).rejects.toThrow(UnsafeUrlError);
        });

        it('allows hostnames that resolve to a public address', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 },
            ]);

            await expect(
                assertSafeUrl('https://example.com/')
            ).resolves.toBeInstanceOf(URL);
        });

        it('allows default https port on a public IP literal', async () => {
            await expect(
                assertSafeUrl('https://1.1.1.1/')
            ).resolves.toBeInstanceOf(URL);
        });
    });
});
