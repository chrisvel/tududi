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
            // Hex-group form the WHATWG URL parser normalizes mapped
            // addresses to (::ffff:127.0.0.1 -> ::ffff:7f00:1), rather than
            // keeping the dotted form.
            ['::ffff:7f00:1', true],
            ['::ffff:a9fe:a9fe', true],
            // Deprecated IPv4-compatible form (::/96), e.g. ::127.0.0.1 ->
            // ::7f00:1.
            ['::7f00:1', true],
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

        // GHSA-h72v-w7gx-hq4h: decimal/hex/octal IPv4 literals resolve to
        // loopback but aren't written in dotted-quad form, and bracketed
        // IPv6 literals normalize in ways the guard previously didn't
        // recognize as private.
        describe('GHSA-h72v-w7gx-hq4h encoded-IP bypasses', () => {
            it.each([
                ['http://2130706433/', 'decimal-encoded loopback'],
                ['http://0x7f000001/', 'hex-encoded loopback'],
                ['http://017700000001/', 'octal-encoded loopback'],
                ['http://127.1/', 'shorthand loopback'],
                ['http://0177.0.0.1/', 'octal-first-octet loopback'],
                ['http://2852039166/', 'decimal-encoded metadata endpoint'],
            ])('rejects %s (%s)', async (url) => {
                await expect(assertSafeUrl(url)).rejects.toThrow(
                    UnsafeUrlError
                );
            });

            it.each([
                ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback'],
                [
                    'http://[::ffff:169.254.169.254]/',
                    'IPv4-mapped metadata endpoint',
                ],
                [
                    'http://[::127.0.0.1]/',
                    'deprecated IPv4-compatible loopback',
                ],
                ['http://[fd00::1]/', 'unique-local literal'],
                ['http://[::1]/', 'bracketed IPv6 loopback literal'],
            ])('rejects %s (%s)', async (url) => {
                await expect(assertSafeUrl(url)).rejects.toThrow(
                    UnsafeUrlError
                );
            });

            it('still allows a bracketed public IPv6 literal', async () => {
                await expect(
                    assertSafeUrl('http://[2001:4860:4860::8888]/')
                ).resolves.toBeInstanceOf(URL);
            });
        });
    });
});
