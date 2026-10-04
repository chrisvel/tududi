const request = require('supertest');
const app = require('../../app');
const { Note, Role, Setting } = require('../../models');
const { getConfig } = require('../../config/config');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

let tokenCounter = 0;
const share = (fields) => ({
    public_token: `${String(++tokenCounter).padStart(4, '0')}${'x'.repeat(39)}`,
    public_shared_at: new Date(),
    ...fields,
});

describe('Blog', () => {
    let admin, adminAgent, other, otherAgent;

    beforeEach(async () => {
        admin = await createTestUser({
            email: `blog_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        adminAgent = await login(admin);
        other = await createTestUser({
            email: `blog_other_${Date.now()}@example.com`,
        });
        otherAgent = await login(other);
    });

    afterEach(async () => {
        await Setting.destroy({ where: { key: 'blog_note_uid' } });
    });

    // A front page linking two posts, one of which links a third; plus a
    // public note nobody links, a private linked note and another user's
    // public note with a linked title.
    async function buildBlog() {
        const family = await Note.create(
            share({
                title: 'How to organize a family',
                content:
                    'A family is not a team.\n\n![People](/api/uploads/note-files/people.png)\n\nSee [[Weekly review]].',
                user_id: admin.id,
            })
        );
        const review = await Note.create(
            share({
                title: 'Weekly review',
                content: '## Sunday\n\nLook at the board.',
                user_id: admin.id,
            })
        );
        const pricing = await Note.create(
            share({
                title: 'Why Cloud',
                content: 'Because servers are work.',
                user_id: admin.id,
            })
        );
        await Note.create(
            share({ title: 'Unlinked', content: 'Hidden.', user_id: admin.id })
        );
        await Note.create({
            title: 'Drafts',
            content: 'Private.',
            user_id: admin.id,
        });
        await Note.create(
            share({ title: 'Why Cloud', content: 'Theirs.', user_id: other.id })
        );
        const index = await Note.create(
            share({
                title: 'Blog',
                content:
                    'Writing about tududi.\n\n[[How to organize a family]]\n\n[[Why Cloud]]\n\n[[Drafts]]',
                user_id: admin.id,
            })
        );
        return { index, family, review, pricing };
    }

    describe('admin', () => {
        it('lets the superadmin pick a note by uid or pasted URL', async () => {
            const { index } = await buildBlog();
            const res = await adminAgent.put('/api/admin/blog').send({
                note: `https://app.tududi.com/notes/${index.uid}-blog`,
            });
            expect(res.status).toBe(200);
            expect(res.body.note_uid).toBe(index.uid);
            expect(res.body.note).toEqual({
                uid: index.uid,
                title: 'Blog',
                shared: true,
            });
            expect(res.body.posts.map((p) => p.slug)).toEqual([
                'how-to-organize-a-family',
                'why-cloud',
                'weekly-review',
            ]);
        });

        it('refuses another user’s note', async () => {
            const theirs = await Note.create(
                share({ title: 'Theirs', content: '', user_id: other.id })
            );
            const res = await adminAgent
                .put('/api/admin/blog')
                .send({ note: theirs.uid });
            expect(res.status).toBe(400);
            expect(
                await Setting.findOne({ where: { key: 'blog_note_uid' } })
            ).toBeNull();
        });

        it('reads the uid from a link with a query, fragment or trailing slash', async () => {
            const { index } = await buildBlog();
            for (const note of [
                `https://app.tududi.com/notes/${index.uid}-blog/?tab=1#top`,
                `${index.uid}#x`,
            ]) {
                const res = await adminAgent
                    .put('/api/admin/blog')
                    .send({ note });
                expect(res.status).toBe(200);
                expect(res.body.note_uid).toBe(index.uid);
            }
        });

        it('refuses input far longer than a note link', async () => {
            const res = await adminAgent
                .put('/api/admin/blog')
                .send({ note: '/'.repeat(10000) + '#'.repeat(10000) });
            expect(res.status).toBe(400);
        });

        it('clears the pick with an empty value', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });
            const res = await adminAgent
                .put('/api/admin/blog')
                .send({ note: '' });
            expect(res.status).toBe(200);
            expect(res.body.note_uid).toBeNull();
            expect((await request(app).get('/api/public/blog')).status).toBe(
                404
            );
        });

        it('is for the superadmin only', async () => {
            expect((await otherAgent.get('/api/admin/blog')).status).toBe(403);
            expect(
                (await otherAgent.put('/api/admin/blog').send({ note: '' }))
                    .status
            ).toBe(403);
        });
    });

    describe('public pages', () => {
        it('is unavailable until a shared note is picked', async () => {
            expect((await request(app).get('/api/public/blog')).status).toBe(
                404
            );
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });
            await index.update({ public_shared_at: null });
            expect((await request(app).get('/api/public/blog')).status).toBe(
                404
            );
        });

        it('lists the posts the front page links, without signing in', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });

            const res = await request(app).get('/api/public/blog');
            expect(res.status).toBe(200);
            expect(res.headers['cache-control']).toMatch(/public/);
            expect(res.headers['x-robots-tag']).toBeUndefined();
            expect(res.body.title).toBe('Blog');
            expect(res.body.posts.map((p) => p.title)).toEqual([
                'How to organize a family',
                'Why Cloud',
            ]);
            const [family] = res.body.posts;
            expect(family.excerpt).toBe('A family is not a team.');
            expect(family.cover).toMatch(
                /^\/api\/public\/notes\/[^/]+\/files\/people\.png$/
            );
            expect(res.body.links.register).toMatch(/\/register$/);
            expect(res.body.links.pricing.monthly).toBe(
                getConfig().pricing.monthly
            );
        });

        it('serves a post by slug with its linked posts', async () => {
            const { index, family } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });

            const res = await request(app).get(
                '/api/public/blog/posts/how-to-organize-a-family'
            );
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('How to organize a family');
            expect(res.body.content).toContain(
                `/api/public/notes/${family.public_token}/files/people.png`
            );
            expect(res.body.content).not.toContain('/api/uploads/');
            expect(res.body.linked_notes).toEqual([
                { title: 'Weekly review', slug: 'weekly-review' },
            ]);
            expect(res.body.more.map((p) => p.slug)).toEqual(['why-cloud']);
        });

        it('serves posts reached through other posts', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });
            const res = await request(app).get(
                '/api/public/blog/posts/weekly-review'
            );
            expect(res.status).toBe(200);
        });

        it('never serves a public note the blog does not link, or a private one', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });
            for (const slug of ['unlinked', 'drafts', 'blog']) {
                const res = await request(app).get(
                    `/api/public/blog/posts/${slug}`
                );
                expect(res.status).toBe(404);
            }
            const res = await request(app).get(
                '/api/public/blog/posts/why-cloud'
            );
            expect(res.body.content).toBe('Because servers are work.');
        });

        it('gives repeated titles their own slugs', async () => {
            await Note.create(
                share({ title: 'Notes', content: 'One.', user_id: admin.id })
            );
            const index = await Note.create(
                share({
                    title: 'Blog',
                    content: '[[Notes]] [[Other notes]]',
                    user_id: admin.id,
                })
            );
            await Note.create(
                share({
                    title: 'Other notes',
                    content: '[[Notes]]',
                    user_id: admin.id,
                })
            );
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });
            const res = await request(app).get('/api/public/blog');
            expect(res.body.posts.map((p) => p.slug)).toEqual([
                'notes',
                'other-notes',
            ]);
        });
    });

    describe('blog host', () => {
        const config = getConfig();
        const original = [...config.blog.hosts];

        beforeAll(() => {
            config.blog.hosts = ['blog.tududi.com'];
        });

        afterAll(() => {
            config.blog.hosts = original;
        });

        it('serves the shell marked as the blog, with the post in the head', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });

            const res = await request(app)
                .get('/how-to-organize-a-family')
                .set('Host', 'blog.tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain(
                '<meta name="tududi-site" content="blog">'
            );
            expect(res.text).toContain(
                '<title>How to organize a family | tududi</title>'
            );
            expect(res.text).toContain(
                '<meta property="og:description" content="A family is not a team.">'
            );
            expect(res.text).toMatch(
                /og:image" content="http:\/\/blog\.tududi\.com\/api\/public\/notes\/[^/]+\/files\/people\.png"/
            );
        });

        it('still marks the front page when the blog is not set up', async () => {
            const res = await request(app)
                .get('/')
                .set('Host', 'blog.tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain('content="blog"');
            expect(res.text).toContain(
                '<script defer src="https://dyneteq.com/admin/s.js"></script>'
            );
            const csp = res.headers['content-security-policy'];
            expect(csp).toMatch(/script-src [^;]*https:\/\/dyneteq\.com/);
            expect(csp).toMatch(/connect-src [^;]*https:\/\/dyneteq\.com/);
        });

        it('lists the posts in the sitemap and the feed', async () => {
            const { index } = await buildBlog();
            await adminAgent.put('/api/admin/blog').send({ note: index.uid });

            const sitemap = await request(app)
                .get('/sitemap.xml')
                .set('Host', 'blog.tududi.com');
            expect(sitemap.status).toBe(200);
            expect(sitemap.text).toContain(
                '<loc>http://blog.tududi.com/weekly-review</loc>'
            );

            const feed = await request(app)
                .get('/rss.xml')
                .set('Host', 'blog.tududi.com');
            expect(feed.status).toBe(200);
            expect(feed.text).toContain(
                '<link>http://blog.tududi.com/why-cloud</link>'
            );
        });

        it('keeps the API reachable and leaves other hosts alone', async () => {
            const api = await request(app)
                .get('/api/public/blog')
                .set('Host', 'blog.tududi.com');
            expect(api.status).toBe(404);
            expect(api.body).toBeInstanceOf(Object);

            const app404 = await request(app)
                .get('/how-to-organize-a-family')
                .set('Host', 'app.tududi.com');
            expect(app404.text).not.toContain('tududi-site');
            expect(app404.text).not.toContain('dyneteq.com');
            expect(app404.headers['content-security-policy']).not.toContain(
                'dyneteq.com'
            );
        });
    });

    describe('landing page link', () => {
        const config = getConfig();
        const original = { ...config.landing };

        beforeAll(() => {
            config.landing.hosts = ['tududi.com'];
            config.landing.appUrl = 'https://app.tududi.com';
        });

        afterAll(() => {
            Object.assign(config.landing, original);
        });

        it('links the blog from the nav and footer when it has a URL', async () => {
            config.landing.blogUrl = 'https://blog.tududi.com';
            for (const path of ['/', '/cloud', '/terms']) {
                const res = await request(app)
                    .get(path)
                    .set('Host', 'tududi.com');
                const links =
                    res.text.match(/href="https:\/\/blog\.tududi\.com"/g) || [];
                expect(links.length).toBe(3);
            }
        });

        it('has no blog link without one', async () => {
            config.landing.blogUrl = null;
            const res = await request(app).get('/').set('Host', 'tududi.com');
            expect(res.text).not.toContain('blog.tududi.com');
        });
    });
});
