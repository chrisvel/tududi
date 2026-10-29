const { renderMarkdown } = require('../../../../modules/blog/render');

const paths = { 'weekly review': '/weekly-review' };
const pathFor = (title) => paths[title.trim().toLowerCase()] || null;

describe('blog renderMarkdown', () => {
    it('renders Markdown and links [[titles]] to their posts', () => {
        const html = renderMarkdown(
            '## Sunday\n\nSee [[Weekly review]] and [[Drafts]].',
            pathFor
        );
        expect(html).toContain('<h2>Sunday</h2>');
        expect(html).toContain('<a href="/weekly-review">Weekly review</a>');
        expect(html).toContain(' and Drafts.');
    });

    it('shows raw HTML as text', () => {
        const html = renderMarkdown(
            'Hi <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>',
            pathFor
        );
        expect(html).not.toMatch(/<img|<script/);
        expect(html).toContain('&lt;script&gt;');
    });

    it('drops unsafe link and image addresses', () => {
        const html = renderMarkdown(
            '[click](javascript:alert(1)) [mail](mailto:a@b.c) ' +
                '[rel](cloud) ![x](data:image/png;base64,AAAA)',
            pathFor
        );
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('data:');
        expect(html).toContain('click');
        expect(html).toContain('<a href="mailto:a@b.c">mail</a>');
        expect(html).toContain('<a href="cloud">rel</a>');
    });

    it('renders a linked video as a player, not an image', () => {
        const html = renderMarkdown('![Walkthrough](/files/a.mp4)', pathFor);
        expect(html).toContain('<video src="/files/a.mp4" controls></video>');
    });
});
