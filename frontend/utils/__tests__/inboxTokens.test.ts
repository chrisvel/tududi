import {
    formatTokenName,
    PROJECT_QUERY_PATTERN,
    readTokenName,
    splitInboxTokens,
    tokenizeInboxText,
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

    it('does not read a quote that never closes as a quoted name', () => {
        // The backslash escapes the last quote, so the name never closes
        expect(splitInboxTokens('+"C:\\" call bob')).toEqual([
            { text: '+"C:\\" call bob' },
        ]);
    });

    it('reads escaped quotes in @person and ~area names too', () => {
        expect(splitInboxTokens('@"Ann \\"Jo\\"" ~"a \\" b" x')).toEqual([
            { text: '@"Ann \\"Jo\\""', kind: 'person' },
            { text: ' ' },
            { text: '~"a \\" b"', kind: 'area' },
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

describe('formatTokenName', () => {
    it('leaves a single word as it is', () => {
        expect(formatTokenName('Chores')).toBe('Chores');
    });

    it('quotes a name with a space', () => {
        expect(formatTokenName('Home office')).toBe('"Home office"');
    });

    it('escapes the quotes and backslashes in a quoted name', () => {
        expect(formatTokenName('foo " bar')).toBe('"foo \\" bar"');
        expect(formatTokenName('say "hi"')).toBe('"say \\"hi\\""');
        expect(formatTokenName('C:\\ drive')).toBe('"C:\\\\ drive"');
    });

    it('is read back as the same name', () => {
        for (const name of [
            'Chores',
            'Home office',
            'foo " bar',
            '"x',
            'a\\',
        ]) {
            expect(readTokenName(formatTokenName(name))).toBe(name);
        }
    });
});

describe('readTokenName', () => {
    it('leaves a quote that never closes as it is', () => {
        expect(readTokenName('"C:\\"')).toBe('"C:\\"');
    });

    it('keeps a backslash that escapes nothing', () => {
        expect(readTokenName('"a\\b c"')).toBe('a\\b c');
    });
});

describe('tokenizeInboxText', () => {
    it('keeps a quoted name with an escaped quote in one token', () => {
        expect(tokenizeInboxText('+"Q4 \\" plan" call bob')).toEqual([
            '+"Q4 \\" plan"',
            'call',
            'bob',
        ]);
    });

    it('splits on spaces after a quote that never closes', () => {
        expect(tokenizeInboxText('+"C:\\" call bob')).toEqual([
            '+"C:\\"',
            'call',
            'bob',
        ]);
        expect(tokenizeInboxText('+"C:\\\\" call bob')).toEqual([
            '+"C:\\\\"',
            'call',
            'bob',
        ]);
    });
});

describe('PROJECT_QUERY_PATTERN', () => {
    it('reads a quoted project name with an escaped quote', () => {
        const match = 'x +"Q4 \\" plan"'.match(PROJECT_QUERY_PATTERN);
        expect(match?.[1]).toBe('Q4 \\" plan');
        expect(readTokenName(`"${match?.[1]}"`)).toBe('Q4 " plan');
    });

    it('reads a plain project name', () => {
        expect('x +Chores'.match(PROJECT_QUERY_PATTERN)?.[2]).toBe('Chores');
    });
});

describe('formatTokenName for areas and people', () => {
    it('quotes and escapes a name with quotes in it', () => {
        expect(formatTokenName('Mom\'s "big" move')).toBe(
            '"Mom\'s \\"big\\" move"'
        );
    });
});
