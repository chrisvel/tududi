import {
    nonEmptyLines,
    splitCaptureText,
    splitFirstLine,
    stripBullet,
} from '../captureText';

describe('captureText', () => {
    describe('splitCaptureText', () => {
        it('keeps all the text together by default, however many lines', () => {
            expect(
                splitCaptureText('Plan trip\nbook train\npack', false)
            ).toEqual(['Plan trip\nbook train\npack']);
        });

        it('returns nothing for blank text', () => {
            expect(splitCaptureText('  \n  ', false)).toEqual([]);
            expect(splitCaptureText('', true)).toEqual([]);
        });

        it('makes one item per non-empty line when asked', () => {
            expect(
                splitCaptureText(
                    'call the bank\n\n  buy milk  \nprint pass',
                    true
                )
            ).toEqual(['call the bank', 'buy milk', 'print pass']);
        });

        it('strips list markers from each line', () => {
            expect(
                splitCaptureText(
                    '- one\n* two\n3. three\n[ ] four\n[x] five',
                    true
                )
            ).toEqual(['one', 'two', 'three', 'four', 'five']);
        });
    });

    describe('splitFirstLine', () => {
        it('uses the first line as the title and the rest as the body', () => {
            expect(splitFirstLine('Title\nline two\nline three')).toEqual({
                first: 'Title',
                rest: 'line two\nline three',
            });
        });

        it('has no body for a single line', () => {
            expect(splitFirstLine('  Just one line ')).toEqual({
                first: 'Just one line',
                rest: '',
            });
        });
    });

    it('lists the non-empty lines and strips one bullet', () => {
        expect(nonEmptyLines('a\n\n b \n')).toEqual(['a', 'b']);
        expect(stripBullet('- item')).toBe('item');
        expect(stripBullet('2019 plan')).toBe('2019 plan');
    });
});
