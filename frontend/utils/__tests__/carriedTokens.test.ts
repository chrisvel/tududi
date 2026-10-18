import { carriedTokens, withCarried } from '../carriedTokens';

describe('carriedTokens', () => {
    it('returns the words the cleaned text left out, in order', () => {
        expect(
            carriedTokens(
                'Pay for water meter until next thursday #home +House',
                'Pay for water meter'
            )
        ).toBe('until next thursday #home +House');
    });

    it('finds words cut from the middle of a line', () => {
        expect(
            carriedTokens(
                'Call @Ana tomorrow about the bank',
                'Call about the bank'
            )
        ).toBe('@Ana tomorrow');
    });

    it('keeps a repeated word that stays in the title', () => {
        expect(carriedTokens('Plan the plan friday', 'Plan the plan')).toBe(
            'friday'
        );
    });

    it('reads tokens from every line', () => {
        expect(
            carriedTokens('Buy milk tomorrow\nask #home', 'Buy milk\nask')
        ).toBe('tomorrow #home');
    });

    it('returns nothing when nothing was cut', () => {
        expect(carriedTokens('Buy milk', 'Buy milk')).toBe('');
    });
});

describe('withCarried', () => {
    it('adds the carried words to the first line', () => {
        expect(withCarried('Buy milk\nnotes', 'tomorrow #home')).toBe(
            'Buy milk tomorrow #home\nnotes'
        );
    });

    it('leaves the text alone when nothing is carried', () => {
        expect(withCarried('Buy milk', '')).toBe('Buy milk');
    });

    it('stands alone when the box is empty', () => {
        expect(withCarried('', 'tomorrow')).toBe('tomorrow');
    });
});
