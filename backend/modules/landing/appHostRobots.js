// Keeps the app host out of search once a marketing host is configured.
// Every path there answers 200 with the same app shell, so any stray link
// would be indexed as another thin "tududi" page. The marketing and blog
// hosts are where indexable content lives; the app keeps only its sign-in
// and sign-up pages findable. robots.txt allows everything on purpose:
// a crawler that is told to stay out never sees the noindex header.
//
// Read from the live config on every request, like the host switches, and
// a no-op on a self-hosted instance with no marketing hosts set.
const INDEXABLE_PATHS = new Set(['/login', '/register']);

function appHostRobots(landing) {
    return (req, res, next) => {
        const hosts = (landing && landing.hosts) || [];
        if (hosts.length === 0 || !landing.appUrl) return next();

        let appHost;
        try {
            appHost = new URL(landing.appUrl).hostname;
        } catch {
            return next();
        }
        if (req.hostname !== appHost) return next();

        if (req.path === '/robots.txt') {
            return res.type('text/plain').send('User-agent: *\nAllow: /\n');
        }
        if (!INDEXABLE_PATHS.has(req.path.replace(/\/$/, ''))) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
        next();
    };
}

module.exports = { appHostRobots };
