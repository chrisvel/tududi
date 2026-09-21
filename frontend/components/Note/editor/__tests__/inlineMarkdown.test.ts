import { isSafeImageUrl, isSafeLinkUrl, renderInline } from '../inlineMarkdown';

const html = (text: string) => {
    const div = document.createElement('div');
    div.append(renderInline(text));
    return div.innerHTML;
};

describe('renderInline', () => {
    it('renders nested formatting without looping', () => {
        expect(html('**a _b_ c**')).toBe('<strong>a <em>b</em> c</strong>');
    });

    it('renders several tokens in one cell', () => {
        expect(html('**Apple** and `pear` and ~~plum~~')).toBe(
            '<strong>Apple</strong> and <code>pear</code> and <s>plum</s>'
        );
    });

    it('never injects markup from cell text', () => {
        expect(html('<img src=x onerror=alert(1)>')).toBe(
            '&lt;img src=x onerror=alert(1)&gt;'
        );
    });

    it('only links safe protocols', () => {
        expect(html('[ok](https://x.dev)')).toContain('href="https://x.dev"');
        expect(html('[bad](javascript:alert(1))')).not.toContain('<a');
    });

    it('marks wikilinks', () => {
        expect(html('[[Note]]')).toBe(
            '<span class="cm-md-wikilink">Note</span>'
        );
    });
});

describe('url guards', () => {
    it('accepts web and mail links only', () => {
        expect(isSafeLinkUrl('https://a.b')).toBe(true);
        expect(isSafeLinkUrl('mailto:a@b.c')).toBe(true);
        expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeLinkUrl('data:text/html,x')).toBe(false);
    });

    it('accepts http(s) and same-origin image paths, not protocol-relative or data URLs', () => {
        expect(isSafeImageUrl('https://a.b/x.png')).toBe(true);
        expect(isSafeImageUrl('/api/uploads/notes/x.png')).toBe(true);
        expect(isSafeImageUrl('//evil.example/x.png')).toBe(false);
        expect(isSafeImageUrl('data:image/svg+xml,<svg/>')).toBe(false);
        expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    });
});
