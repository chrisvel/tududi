const { excerptOf } = require('../../../../modules/blog/service')._internal;

describe('blog excerpt', () => {
    it('skips an image wrapped in a link, like a video poster', () => {
        const content = [
            '[![Watch](/api/uploads/note-files/poster.png)](/api/uploads/note-files/walkthrough.mp4)',
            '*Caption under the poster.*',
            'A developer does not work in departments.',
        ].join('\n\n');
        expect(excerptOf(content)).toBe(
            'A developer does not work in departments.'
        );
    });

    it('skips a video written as an image', () => {
        const content =
            '![Walkthrough](/api/uploads/note-files/walkthrough.mp4)\n\nFirst words.';
        expect(excerptOf(content)).toBe('First words.');
    });
});
