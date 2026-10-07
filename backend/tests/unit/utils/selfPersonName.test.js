const { selfPersonName } = require('../../../utils/selfPersonName');

describe('selfPersonName', () => {
    it('uses the first and last name when there is one', () => {
        expect(
            selfPersonName({
                name: 'Ada',
                surname: 'Lovelace',
                email: 'a@x.io',
            })
        ).toBe('Ada Lovelace');
    });

    it('uses just the first name', () => {
        expect(selfPersonName({ name: 'Ada', email: 'a@x.io' })).toBe('Ada');
    });

    it('uses just the last name', () => {
        expect(selfPersonName({ surname: 'Lovelace' })).toBe('Lovelace');
    });

    it('falls back to the part of the email before the @', () => {
        expect(selfPersonName({ email: 'ada.l@example.com' })).toBe('ada.l');
    });

    it('does not fail for an account with neither a name nor an email', () => {
        expect(selfPersonName({ name: null, surname: null, email: null })).toBe(
            'Member'
        );
        expect(selfPersonName({})).toBe('Member');
    });
});
