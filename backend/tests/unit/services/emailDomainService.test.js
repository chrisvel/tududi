const {
    domainOf,
    isDisposableDomain,
} = require('../../../services/emailDomainService');

describe('emailDomainService.domainOf', () => {
    it('returns the lowercased part after the last @', () => {
        expect(domainOf('Jane@Gmail.COM')).toBe('gmail.com');
        expect(domainOf('"odd@local"@proton.me')).toBe('proton.me');
    });
});

describe('emailDomainService.isDisposableDomain', () => {
    it.each(['mailinator.com', 'yopmail.com', 'guerrillamail.com'])(
        'flags %s',
        (domain) => {
            expect(isDisposableDomain(domain)).toBe(true);
        }
    );

    it('flags a subdomain of a disposable provider', () => {
        expect(isDisposableDomain('inbox.mailinator.com')).toBe(true);
    });

    it.each(['gmail.com', 'outlook.com', 'proton.me', 'icloud.com', 'com'])(
        'leaves %s alone',
        (domain) => {
            expect(isDisposableDomain(domain)).toBe(false);
        }
    );
});
