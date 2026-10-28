'use strict';

const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const { SiteVisit } = require('../models');
const { getConfig } = require('../config/config');
const { logError } = require('./logService');

// Counts the pages people open, for the admin dashboard.
//
// A visit is a navigation that was answered with a page: the marketing site,
// the blog, or the app shell. Redirects, errors, API calls and assets are
// not visits. Nothing identifying is kept: the visitor is a hash of address
// and browser salted with the UTC day, so it separates two people on one day
// and cannot follow anyone to the next.

const SURFACES = ['landing', 'blog', 'app'];
const RETENTION_DAYS = 90;
const MAX_PATH = 128;
const MAX_HOST = 255;

// Crawlers, uptime monitors, link-preview fetchers and scripts. A browser
// engine in the string is not enough to be a person, so the names go first.
const NOT_A_PERSON =
    /bot|crawl|spider|slurp|preview|monitor|uptime|pingdom|curl|wget|python|go-http|java\/|okhttp|headless|lighthouse|scrapy|axios|node-fetch|facebookexternalhit|embedly|whatsapp|telegram|discord|slack/i;

const dayOf = (date) => date.toISOString().slice(0, 10);

function hostList(key) {
    const config = getConfig();
    return (config[key] && config[key].hosts) || [];
}

// Which door the request came through.
function surfaceOf(req) {
    const host = (req.hostname || '').toLowerCase();
    if (hostList('landing').includes(host)) return 'landing';
    if (hostList('blog').includes(host)) return 'blog';
    if (req.path === '/blog' || req.path.startsWith('/blog/')) return 'blog';
    return 'app';
}

// The page without its query string or ids. Marketing and blog pages keep
// two segments ('/fr/cloud', '/blog/some-post'); the app keeps one, because
// everything after it is a record's uid.
function pathOf(req, surface) {
    const segments = req.path.split('/').filter(Boolean);
    const keep = surface === 'app' ? 1 : 2;
    return `/${segments.slice(0, keep).join('/')}`.slice(0, MAX_PATH);
}

// Where the visitor came from, as a bare hostname. A page opened from
// another page of the same site is not a referral.
function referrerHostOf(req) {
    const header = req.get('referer');
    if (!header) return null;
    let host;
    try {
        host = new URL(header).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
    if (!host || host === (req.hostname || '').toLowerCase()) return null;
    return host.slice(0, MAX_HOST);
}

function visitorHash(req, day) {
    return crypto
        .createHash('sha256')
        .update(
            `${getConfig().secret}|${day}|${req.ip}|${req.get('user-agent')}`
        )
        .digest('hex')
        .slice(0, 32);
}

// Whether this exchange was a person opening a page.
function isVisit(req, res) {
    if (req.method !== 'GET') return false;
    if (res.statusCode !== 200 && res.statusCode !== 304) return false;
    if (req.path.startsWith('/api/')) return false;
    if (!String(req.get('accept') || '').includes('text/html')) return false;
    const purpose = req.get('sec-purpose') || req.get('purpose');
    if (purpose && /prefetch|prerender/i.test(purpose)) return false;
    const agent = req.get('user-agent');
    return !!agent && !NOT_A_PERSON.test(agent);
}

// Express middleware. Records after the response is sent, so it can see what
// was answered and never delays or fails a page.
function track() {
    return (req, res, next) => {
        if (getConfig().visits?.enabled === false) return next();
        res.on('finish', () => {
            if (!isVisit(req, res)) return;
            const now = new Date();
            const day = dayOf(now);
            const surface = surfaceOf(req);
            SiteVisit.create({
                surface,
                path: pathOf(req, surface),
                referrer_host: referrerHostOf(req),
                visitor_hash: visitorHash(req, day),
                day,
                user_id: surface === 'app' ? req.session?.userId || null : null,
            }).catch((error) => logError('Failed to record a visit:', error));
        });
        return next();
    };
}

async function prune(now = new Date()) {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400000);
    return SiteVisit.destroy({ where: { day: { [Op.lt]: dayOf(cutoff) } } });
}

// What the dashboard shows. `days` are the UTC days of the window, oldest
// first. Views and visitors are per surface per day; a week's visitors are
// the sum of its days, since the hash does not carry across them.
async function summary(days, now = new Date()) {
    const today = dayOf(now);
    const first = days[0];
    const weekStart = days[days.length - 7];
    const monthStart = dayOf(new Date(now.getTime() - 29 * 86400000));

    const [perDay, pages, referrers, dau, wau, prevWau, mau] =
        await Promise.all([
            SiteVisit.findAll({
                attributes: [
                    'day',
                    'surface',
                    [fn('COUNT', col('id')), 'views'],
                    [
                        fn('COUNT', fn('DISTINCT', col('visitor_hash'))),
                        'visitors',
                    ],
                ],
                where: { day: { [Op.gte]: first } },
                group: ['day', 'surface'],
                raw: true,
            }),
            SiteVisit.findAll({
                attributes: [
                    'surface',
                    'path',
                    [fn('COUNT', col('id')), 'views'],
                ],
                where: {
                    day: { [Op.gte]: weekStart },
                    surface: { [Op.in]: ['landing', 'blog'] },
                },
                group: ['surface', 'path'],
                order: [
                    [fn('COUNT', col('id')), 'DESC'],
                    ['path', 'ASC'],
                ],
                limit: 8,
                raw: true,
            }),
            SiteVisit.findAll({
                attributes: [
                    'referrer_host',
                    [fn('COUNT', col('id')), 'views'],
                ],
                where: {
                    day: { [Op.gte]: weekStart },
                    referrer_host: { [Op.ne]: null },
                    surface: { [Op.in]: ['landing', 'blog'] },
                },
                group: ['referrer_host'],
                order: [
                    [fn('COUNT', col('id')), 'DESC'],
                    ['referrer_host', 'ASC'],
                ],
                limit: 8,
                raw: true,
            }),
            distinctUsers({ [Op.eq]: today }),
            distinctUsers({ [Op.gte]: weekStart }),
            distinctUsers({
                [Op.gte]: days[days.length - 14],
                [Op.lt]: weekStart,
            }),
            distinctUsers({ [Op.gte]: monthStart }),
        ]);

    const bySurface = {};
    for (const surface of SURFACES) {
        bySurface[surface] = days.map((date) => ({
            date,
            views: 0,
            visitors: 0,
        }));
    }
    const index = new Map(days.map((d, i) => [d, i]));
    for (const row of perDay) {
        const slot = bySurface[row.surface]?.[index.get(row.day)];
        if (slot) {
            slot.views = Number(row.views);
            slot.visitors = Number(row.visitors);
        }
    }

    const total = (list, field) => list.reduce((n, d) => n + d[field], 0);
    const result = {};
    for (const surface of SURFACES) {
        const list = bySurface[surface];
        result[surface] = {
            views: {
                today: list[list.length - 1].views,
                last7d: total(list.slice(7), 'views'),
                prev7d: total(list.slice(0, 7), 'views'),
            },
            visitors: {
                today: list[list.length - 1].visitors,
                last7d: total(list.slice(7), 'visitors'),
                prev7d: total(list.slice(0, 7), 'visitors'),
            },
        };
    }

    // The marketing site and the blog together, per day, for the chart.
    const together = days.map((date, i) => ({
        date,
        views: bySurface.landing[i].views + bySurface.blog[i].views,
        visitors: bySurface.landing[i].visitors + bySurface.blog[i].visitors,
    }));

    return {
        ...result,
        days: together,
        top_pages: pages.map((p) => ({
            surface: p.surface,
            path: p.path,
            views: Number(p.views),
        })),
        top_referrers: referrers.map((r) => ({
            host: r.referrer_host,
            views: Number(r.views),
        })),
        app_users: { dau, wau, prev_wau: prevWau, mau },
    };
}

// People on the marketing site or the blog from the UTC day `from` up to,
// not including, `to`. Counted per day like the rest of this file, but a
// person who read the blog and then the landing page that day counts once.
async function siteVisitors(from, to) {
    const rows = await SiteVisit.findAll({
        attributes: [
            'day',
            [fn('COUNT', fn('DISTINCT', col('visitor_hash'))), 'visitors'],
        ],
        where: {
            day: { [Op.gte]: from, [Op.lt]: to },
            surface: { [Op.in]: ['landing', 'blog'] },
        },
        group: ['day'],
        raw: true,
    });
    return rows.reduce((n, row) => n + Number(row.visitors), 0);
}

async function distinctUsers(dayCondition) {
    const row = await SiteVisit.findOne({
        attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'users']],
        where: {
            surface: 'app',
            user_id: { [Op.ne]: null },
            day: dayCondition,
        },
        raw: true,
    });
    return Number(row?.users || 0);
}

module.exports = {
    track,
    prune,
    summary,
    siteVisitors,
    isVisit,
    surfaceOf,
    pathOf,
    SURFACES,
    RETENTION_DAYS,
};
