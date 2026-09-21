const dns = require('dns');
const waitlist = require('../../../services/waitlistService');

const { Resolver } = dns.promises;

const dnsError = (code) => Object.assign(new Error(code), { code });

describe('waitlistService.isValidEmail', () => {
    it('accepts an ordinary address', () => {
        expect(waitlist.isValidEmail('jane@gmail.com')).toBe(true);
        expect(waitlist.isValidEmail('apps+tududi@stx.addymail.com')).toBe(
            true
        );
    });

    it('rejects addresses that are not the right shape', () => {
        expect(waitlist.isValidEmail('')).toBe(false);
        expect(waitlist.isValidEmail('not-an-email')).toBe(false);
        expect(waitlist.isValidEmail('a@b')).toBe(false);
    });

    it.each([
        'example@example.com',
        'example123123@example.com',
        'someone@example.net',
        'someone@example.org',
        'someone@mail.example.com',
        'someone@company.example',
        'someone@company.invalid',
        'someone@localhost',
        'someone@company.test',
        'someone@printer.local',
    ])('rejects the reserved domain in %s', (email) => {
        expect(waitlist.isValidEmail(email)).toBe(false);
    });

    it('does not mistake a real domain that merely contains "example"', () => {
        expect(waitlist.isValidEmail('jane@notexample.com')).toBe(true);
        expect(waitlist.isValidEmail('jane@example.com.au')).toBe(true);
        expect(waitlist.isValidEmail('jane@testing.io')).toBe(true);
    });
});

describe('waitlistService.acceptsMail', () => {
    let mx;
    let a;
    let aaaa;

    beforeEach(() => {
        mx = jest.spyOn(Resolver.prototype, 'resolveMx');
        a = jest.spyOn(Resolver.prototype, 'resolve4');
        aaaa = jest.spyOn(Resolver.prototype, 'resolve6');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('accepts a domain with an MX record', async () => {
        mx.mockResolvedValue([{ exchange: 'mx.gmail.com', priority: 10 }]);
        expect(await waitlist.acceptsMail('gmail.com')).toBe(true);
        expect(a).not.toHaveBeenCalled();
    });

    it('rejects a null MX, which says the domain takes no mail', async () => {
        mx.mockResolvedValue([{ exchange: '', priority: 0 }]);
        expect(await waitlist.acceptsMail('example.com')).toBe(false);
    });

    it('rejects a domain that does not exist', async () => {
        mx.mockRejectedValue(dnsError('ENOTFOUND'));
        a.mockRejectedValue(dnsError('ENOTFOUND'));
        aaaa.mockRejectedValue(dnsError('ENOTFOUND'));
        expect(await waitlist.acceptsMail('gmial.invalidtld')).toBe(false);
    });

    it('falls back to the address record when there is no MX', async () => {
        mx.mockRejectedValue(dnsError('ENODATA'));
        a.mockResolvedValue(['203.0.113.7']);
        expect(await waitlist.acceptsMail('small-site.dev')).toBe(true);
    });

    it('rejects a domain with neither MX nor address records', async () => {
        mx.mockRejectedValue(dnsError('ENODATA'));
        a.mockRejectedValue(dnsError('ENODATA'));
        aaaa.mockRejectedValue(dnsError('ENODATA'));
        expect(await waitlist.acceptsMail('parked.dev')).toBe(false);
    });

    it.each(['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED'])(
        'fails open on %s so a flaky resolver never drops a signup',
        async (code) => {
            mx.mockRejectedValue(dnsError(code));
            expect(await waitlist.acceptsMail('gmail.com')).toBe(true);
        }
    );

    it('fails open when the fallback lookup hits a resolver error', async () => {
        mx.mockRejectedValue(dnsError('ENODATA'));
        a.mockRejectedValue(dnsError('ETIMEOUT'));
        expect(await waitlist.acceptsMail('small-site.dev')).toBe(true);
    });
});
