const crypto = require('crypto');
const {
    formatEntityTag,
    generateETag,
    parseETag,
} = require('../../../../../modules/caldav/utils/etag-generator');
const {
    generateCTag,
} = require('../../../../../modules/caldav/utils/ctag-generator');

// #2008: a change to the iCalendar output has to reach clients that already hold
// the task, and they only re-download when these tags change.
describe('format version', () => {
    const task = {
        id: 1,
        uid: 'task',
        updated_at: new Date('2026-04-14T12:00:00Z'),
        completed_at: null,
        status: 0,
    };
    const md5 = (text) =>
        crypto.createHash('md5').update(text).digest('hex').substring(0, 8);

    it('moves the ETag away from the unversioned hash', () => {
        const unversioned = crypto
            .createHash('sha256')
            .update(
                JSON.stringify({
                    id: task.id,
                    uid: task.uid,
                    updated_at: task.updated_at,
                    completed_at: task.completed_at,
                    status: task.status,
                })
            )
            .digest('hex');
        expect(generateETag(task)).not.toBe(`"${unversioned}"`);
    });

    it('moves the CTag away from the unversioned hash', () => {
        const time = task.updated_at.getTime();
        expect(generateCTag([task])).not.toBe(
            `"ctag-${time}-${md5(`${time}-${task.id}`)}"`
        );
    });
});

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
