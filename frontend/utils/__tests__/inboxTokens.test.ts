import {
    formatProjectTokenName,
    readProjectTokenName,
    splitInboxTokens,
} from '../inboxTokens';

describe('splitInboxTokens', () => {
    it('keeps plain text as one run', () => {
        expect(splitInboxTokens('Visit Crete')).toEqual([
            { text: 'Visit Crete' },
        ]);
    });

    it('marks each token kind and keeps the spaces between them', () => {
        expect(splitInboxTokens('#admin ~Career +Chores @Ann')).toEqual([
            { text: '#admin', kind: 'tag' },
            { text: ' ' },
            { text: '~Career', kind: 'area' },
            { text: ' ' },
            { text: '+Chores', kind: 'project' },
            { text: ' ' },
            { text: '@Ann', kind: 'person' },
        ]);
    });

    it('reads quoted names as one token', () => {
        expect(
            splitInboxTokens('x +"Birthday party Saturday 3pm" @"John Doe"')
        ).toEqual([
            { text: 'x ' },
            { text: '+"Birthday party Saturday 3pm"', kind: 'project' },
            { text: ' ' },
            { text: '@"John Doe"', kind: 'person' },
        ]);
    });

    it('reads a quoted name with an escaped quote as one token', () => {
        expect(splitInboxTokens('+"foo \\" bar" x')).toEqual([
            { text: '+"foo \\" bar"', kind: 'project' },
            { text: ' x' },
        ]);
    });

    it('ignores a sign that is not at the start of a word', () => {
        expect(splitInboxTokens('mail me@home.com C#')).toEqual([
            { text: 'mail me@home.com C#' },
        ]);
    });

    it('keeps line breaks in the plain runs', () => {
        expect(splitInboxTokens('#a\nb')).toEqual([
            { text: '#a', kind: 'tag' },
            { text: '\nb' },
        ]);
    });
});

describe('formatProjectTokenName', () => {
    it('leaves a single word as it is', () => {
        expect(formatProjectTokenName('Chores')).toBe('Chores');
    });

    it('quotes a name with a space', () => {
        expect(formatProjectTokenName('Home office')).toBe('"Home office"');
    });

    it('escapes the quotes and backslashes in a quoted name', () => {
        expect(formatProjectTokenName('foo " bar')).toBe('"foo \\" bar"');
        expect(formatProjectTokenName('say "hi"')).toBe('"say \\"hi\\""');
        expect(formatProjectTokenName('C:\\ drive')).toBe('"C:\\\\ drive"');
    });

    it('is read back as the same name', () => {
        for (const name of [
            'Chores',
            'Home office',
            'foo " bar',
            '"x',
            'a\\',
        ]) {
            expect(readProjectTokenName(formatProjectTokenName(name))).toBe(
                name
            );
        }
    });
});
