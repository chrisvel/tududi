const {
    formatEntityTag,
    parseETag,
} = require('../../../../../modules/caldav/utils/etag-generator');

describe('formatEntityTag', () => {
    it('wraps a bare etag in quotes', () => {
        expect(formatEntityTag('8b36704d1f6b')).toBe('"8b36704d1f6b"');
    });

    it('does not double-quote an etag that is already quoted', () => {
        expect(formatEntityTag('"8b36704d1f6b"')).toBe('"8b36704d1f6b"');
    });

    it('leaves a weak etag as it is', () => {
        expect(formatEntityTag('W/"abc"')).toBe('W/"abc"');
    });

    it('returns null for an empty etag', () => {
        expect(formatEntityTag(undefined)).toBeNull();
        expect(formatEntityTag('')).toBeNull();
    });

    it('round-trips with parseETag', () => {
        expect(parseETag(formatEntityTag('abc123'))).toBe('abc123');
    });
});
