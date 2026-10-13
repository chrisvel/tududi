'use strict';

const fs = require('fs');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');
const blogService = require('./service');

// The blog's name, as the frontend header shows it (utils/blogService.ts).
const BLOG_TAGLINE = '…before someone else does.';
const BLOG_NAME = 'Let’s take control… before someone else does.';

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

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

// The head of one blog page: the marker the frontend switches on, plus a
// title, description and Open Graph tags so a shared link previews properly
// even though the page itself renders in the browser.
async function headFor(req, origin) {
    const tags = ['<meta name="tududi-site" content="blog">', STATS_TAG];
    let title = `${BLOG_NAME} | tududi`;
    let description = '';
    let image = null;
    let type = 'website';

    try {
        const match = req.path.match(SLUG);
        if (match) {
            const post = await blogService.getPost(match[1]);
            title = `${post.title} | tududi`;
            description = post.excerpt;
            const cover = post.content.match(/!\[[^\]]*\]\(([^)\s]+)/);
            image = cover ? cover[1] : null;
            type = 'article';
        } else if (req.path === '/') {
            description = (await blogService.getIndex()).excerpt;
        }
    } catch {
        // A missing post still gets the page; the frontend shows the message.
    }

    const absolute = (url) =>
        /^https?:\/\//.test(url) ? url : `${origin}${url}`;
    const pageUrl = `${origin}${req.path === '/' ? '/' : req.path}`;
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
    return { title, tags };
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
        `    <description>${escapeHtml(index.excerpt || BLOG_TAGLINE)}</description>\n` +
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

            const { title, tags } = await headFor(req, origin);
            const html = readShell()
                .replace(
                    /<title>[^<]*<\/title>/,
                    `<title>${escapeHtml(title)}</title>`
                )
                .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
            const csp = res.getHeader('Content-Security-Policy');
            if (csp) res.setHeader('Content-Security-Policy', allowStats(csp));
            res.set('Cache-Control', 'no-cache');
            return res.type('html').send(html);
        } catch (error) {
            logError(error, 'Blog page failed');
            return next(error);
        }
    };
}

module.exports = { hostSwitch, BLOG_NAME };
