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

describe('canonicalEmail', () => {
    const { canonicalEmail } = require('../../../services/emailDomainService');

    it('folds Gmail dots, +tags and googlemail into one mailbox', () => {
        expect(canonicalEmail(' Jane.Doe+trial@GoogleMail.com ')).toBe(
            'janedoe@gmail.com'
        );
        expect(canonicalEmail('j.a.n.e.doe@gmail.com')).toBe(
            'janedoe@gmail.com'
        );
    });

    it('drops +tags but keeps dots elsewhere', () => {
        expect(canonicalEmail('first.last+x@fastmail.com')).toBe(
            'first.last@fastmail.com'
        );
    });

    it('leaves odd input alone', () => {
        expect(canonicalEmail('+only@example.com')).toBe('+only@example.com');
        expect(canonicalEmail('')).toBeNull();
    });
});
