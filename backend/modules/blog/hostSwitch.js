'use strict';

const fs = require('fs');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');
const blogService = require('./service');
const { NotFoundError } = require('../../shared/errors');
const { escapeHtml, renderMarkdown } = require('./render');

// The blog's name, as the frontend header shows it (utils/blogService.ts).
const BLOG_TAGLINE =
    'Ideas and stories for running a busy home, or a busy team, with less in your head.';
const BLOG_NAME = 'Small things, sorted.';
const BLOG_AUTHOR = 'Chris Veleris';

const SLUG = /^\/([a-z0-9-]{1,200})$/;

// DYNETEQ stats: cookieless page counts for the blog host only, so the app
// shell everywhere else stays free of it.
const STATS_ORIGIN = 'https://dyneteq.com';
const STATS_TAG = `<script defer src="${STATS_ORIGIN}/admin/s.js"></script>`;

// Helmet's policy with the stats host added to script-src and connect-src.
function allowStats(csp) {
    if (!csp) return csp;
    return String(csp)
        .split(';')
        .map((directive) =>
            /^\s*(script-src|connect-src)\s/.test(directive)
                ? `${directive.trimEnd()} ${STATS_ORIGIN}`
                : directive
        )
        .join(';');
}

const dateLabel = (value) =>
    new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

// JSON for a <script> block; "<" is escaped so the text cannot close it.
const jsonLd = (data) =>
    `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const postLinks = (posts) =>
    '<ul>' +
    posts
        .map(
            (p) =>
                `<li><a href="/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a>` +
                (p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : '') +
                '</li>'
        )
        .join('') +
    '</ul>';

// One blog page as the server sends it: the marker the frontend switches
// on, a title, description and Open Graph tags so a shared link previews
// properly, and the text itself in the root element for crawlers and
// readers without scripts. React replaces the body when it mounts.
async function pageFor(req, origin) {
    const tags = ['<meta name="tududi-site" content="blog">', STATS_TAG];
    let title = `${BLOG_NAME} | tududi`;
    let description = BLOG_TAGLINE;
    let image = null;
    let type = 'website';
    let body = '';
    let status = 200;

    const absolute = (url) =>
        /^https?:\/\//.test(url) ? url : `${origin}${url}`;
    const pageUrl = `${origin}${req.path === '/' ? '/' : req.path}`;
    const match = req.path.match(SLUG);

    try {
        if (match) {
            const post = await blogService.page(match[1]);
            title = `${post.title} | tududi`;
            description = post.excerpt;
            image = blogService.coverOf(post.content);
            type = 'article';
            body =
                '<main><article>' +
                `<h1>${escapeHtml(post.title)}</h1>` +
                (post.published_at
                    ? `<p><time datetime="${new Date(post.published_at).toISOString()}">${dateLabel(post.published_at)}</time></p>`
                    : '') +
                renderMarkdown(post.content, post.pathFor) +
                '</article>' +
                (post.more.length > 0
                    ? `<nav><h2>More posts</h2>${postLinks(post.more)}</nav>`
                    : '') +
                '</main>';
            tags.push(
                jsonLd({
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: post.title,
                    description: post.excerpt || undefined,
                    image: image ? [absolute(image)] : undefined,
                    datePublished: post.published_at
                        ? new Date(post.published_at).toISOString()
                        : undefined,
                    dateModified: post.updated_at
                        ? new Date(post.updated_at).toISOString()
                        : undefined,
                    author: { '@type': 'Person', name: BLOG_AUTHOR },
                    mainEntityOfPage: pageUrl,
                })
            );
        } else if (req.path === '/') {
            const index = await blogService.page(null);
            body =
                '<main>' +
                `<h1>${escapeHtml(BLOG_NAME)}</h1>` +
                `<p>${escapeHtml(BLOG_TAGLINE)}</p>` +
                postLinks(index.posts) +
                '</main>';
        } else {
            status = 404;
        }
    } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        // An older address of a renamed post moves for good to the new one.
        const moved = match ? await blogService.movedTo(match[1]) : null;
        if (moved) return { redirect: `/${moved}` };
        // The front page stays up while the blog is not set up; the
        // frontend shows the message.
        if (match) status = 404;
    }

    if (status === 404) {
        title = 'Not found | tududi';
        description = '';
        type = 'website';
        tags.push('<meta name="robots" content="noindex">');
        body = '<main><h1>This post is not available.</h1></main>';
    }

    tags.push(
        `<link rel="canonical" href="${escapeHtml(pageUrl)}">`,
        `<meta property="og:type" content="${type}">`,
        `<meta property="og:site_name" content="tududi">`,
        `<meta property="og:title" content="${escapeHtml(title.replace(/ \| tududi$/, ''))}">`,
        `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
        `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`
    );
    if (description) {
        tags.push(
            `<meta name="description" content="${escapeHtml(description)}">`,
            `<meta property="og:description" content="${escapeHtml(description)}">`
        );
    }
    if (image) {
        tags.push(
            `<meta property="og:image" content="${escapeHtml(absolute(image))}">`
        );
    }
    tags.push(
        `<link rel="alternate" type="application/rss+xml" title="tududi blog" href="${escapeHtml(origin)}/rss.xml">`
    );
    return { status, title, tags, body };
}

// The built shell has no <html> tag (the minifier drops it), so the
// language goes on whichever is there.
function withLang(html) {
    if (/<html[\s>]/i.test(html)) {
        return html.replace(/<html(?![^>]*\slang=)/i, '<html lang="en"');
    }
    return html.replace(/<!doctype html>/i, '$&<html lang="en">');
}

function sitemap(origin, entries) {
    const urls = entries
        .map(
            (e) =>
                `  <url><loc>${escapeHtml(origin + e.path)}</loc>` +
                (e.updated_at
                    ? `<lastmod>${new Date(e.updated_at).toISOString()}</lastmod>`
                    : '') +
                '</url>'
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function rss(origin, index) {
    const items = index.posts
        .map(
            (p) =>
                '    <item>\n' +
                `      <title>${escapeHtml(p.title)}</title>\n` +
                `      <link>${escapeHtml(`${origin}/${p.slug}`)}</link>\n` +
                `      <guid>${escapeHtml(`${origin}/${p.slug}`)}</guid>\n` +
                (p.published_at
                    ? `      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>\n`
                    : '') +
                `      <description>${escapeHtml(p.excerpt)}</description>\n` +
                '    </item>'
        )
        .join('\n');
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n' +
        `    <title>${escapeHtml(BLOG_NAME)}</title>\n` +
        `    <link>${escapeHtml(`${origin}/`)}</link>\n` +
        `    <description>${escapeHtml(BLOG_TAGLINE)}</description>\n` +
        `${items}\n  </channel>\n</rss>\n`
    );
}

// Splits traffic by hostname, like the landing page's switch. On a blog host
// every page path gets the app shell marked as the blog, so the frontend
// renders the blog at the root instead of the app; the API, built assets and
// locales pass through untouched. On every other host, or with no blog host
// configured, this is a no-op.
//
// The host list is read on every request so the live config can be changed
// under test.
function hostSwitch({ shellPath, cacheShell }) {
    let shell = null;
    const readShell = () => {
        if (shell && cacheShell) return shell;
        shell = fs.readFileSync(shellPath(), 'utf8');
        return shell;
    };

    return async (req, res, next) => {
        const hosts = getConfig().blog.hosts || [];
        if (hosts.length === 0 || !hosts.includes(req.hostname)) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (req.path.startsWith('/api/') || req.path.startsWith('/locales/'))
            return next();

        const origin = `${req.protocol}://${req.get('host')}`;
        try {
            if (req.path === '/robots.txt') {
                return res
                    .type('text/plain')
                    .send(
                        `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
                    );
            }
            if (req.path === '/sitemap.xml') {
                res.set('Cache-Control', 'public, max-age=300');
                return res
                    .type('application/xml')
                    .send(sitemap(origin, await blogService.sitemapEntries()));
            }
            if (req.path === '/rss.xml') {
                let index;
                try {
                    index = await blogService.getIndex();
                } catch {
                    return res.status(404).end();
                }
                res.set('Cache-Control', 'public, max-age=300');
                return res.type('application/rss+xml').send(rss(origin, index));
            }
            // Built files (scripts, images, the service worker) are served
            // by the static handlers further down.
            if (/\.[a-z0-9]+$/i.test(req.path)) return next();

            const { redirect, status, title, tags, body } = await pageFor(
                req,
                origin
            );
            if (redirect) return res.redirect(301, redirect);
            const html = withLang(readShell())
                .replace(
                    /<title>[^<]*<\/title>/,
                    `<title>${escapeHtml(title)}</title>`
                )
                .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
                .replace(
                    /<div id="?root"?><\/div>/,
                    () => `<div id="root">${body}</div>`
                );
            const csp = res.getHeader('Content-Security-Policy');
            if (csp) res.setHeader('Content-Security-Policy', allowStats(csp));
            res.set('Cache-Control', 'no-cache');
            return res.status(status).type('html').send(html);
        } catch (error) {
            logError(error, 'Blog page failed');
            return next(error);
        }
    };
}

module.exports = { hostSwitch, BLOG_NAME };
