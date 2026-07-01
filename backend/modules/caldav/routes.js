const express = require('express');
const caldavAuth = require('./middleware/caldav-auth');
const xmlParser = require('./middleware/xml-parser');
const {
    handleWellKnown,
    handleRootPropfind,
    handlePrincipalPropfind,
} = require('./protocol/discovery');
const { handleOptions } = require('./webdav/options');
const { handlePropfind } = require('./webdav/propfind');
const { handleReport } = require('./webdav/report');
const {
    handleGetTask,
    handlePutTask,
    handleDeleteTask,
} = require('./webdav/task-handlers');
// Per-project calendars (opt-in via CALDAV_PROJECTS_AS_CALENDARS)
const {
    handleCalendarHomePropfind,
    handleProjectPropfind,
    handleProjectReport,
} = require('./webdav/projects');
const apiRoutes = require('./api/routes');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// GET redirects to /caldav/ per RFC 6764; PROPFIND returns root discovery for iOS accountsd
router.all('/.well-known/caldav', (req, res, next) => {
    if (req.method === 'GET') return handleWellKnown(req, res, next);
    if (req.method !== 'PROPFIND') return next();
    xmlParser(req, res, () =>
        caldavAuth(req, res, () => handleRootPropfind(req, res, next))
    );
});

// iOS accountsd probes PROPFIND / and PROPFIND /principals/ during account setup and refresh.
// Gate on PROPFIND only - running caldavAuth on GET / would send WWW-Authenticate: Basic
// and replace the web app login page with a browser Basic-Auth prompt.
router.all('/', (req, res, next) => {
    if (req.method !== 'PROPFIND') return next();
    xmlParser(req, res, () =>
        caldavAuth(req, res, () => handleRootPropfind(req, res, next))
    );
});

router.all('/principals/', (req, res, next) => {
    if (req.method !== 'PROPFIND') return next();
    xmlParser(req, res, () =>
        caldavAuth(req, res, () => handleRootPropfind(req, res, next))
    );
});

router.options('/caldav/:username/', xmlParser, caldavAuth, handleOptions);
router.options(
    '/caldav/:username/tasks/',
    xmlParser,
    caldavAuth,
    handleOptions
);
router.options(
    '/caldav/:username/tasks/:uid',
    xmlParser,
    caldavAuth,
    handleOptions
);
// Per-project OPTIONS
router.options(
    '/caldav/:username/projects/',
    xmlParser,
    caldavAuth,
    handleOptions
);
router.options(
    '/caldav/:username/projects/:projectUid/',
    xmlParser,
    caldavAuth,
    handleOptions
);
router.options(
    '/caldav/:username/projects/:projectUid/:uid',
    xmlParser,
    caldavAuth,
    handleOptions
);

function registerMethod(method, path, handler) {
    router.all(path, xmlParser, caldavAuth, (req, res, next) => {
        if (req.method === method) {
            return handler(req, res, next);
        }
        next();
    });
}

registerMethod('PROPFIND', '/caldav/', handleRootPropfind);
registerMethod('PROPFIND', '/caldav/:username/', handlePrincipalPropfind);
registerMethod('PROPFIND', '/caldav/:username/tasks/', handlePropfind);
registerMethod('PROPFIND', '/caldav/:username/tasks/:uid', handlePropfind);

registerMethod('REPORT', '/caldav/:username/tasks/', handleReport);

// Per-project calendar tree (opt-in). calendar-home is /caldav/<user>/projects/,
// which lists one calendar per project plus a "(No Project)" calendar. These
// handlers 404 unless CALDAV_PROJECTS_AS_CALENDARS=true.
registerMethod(
    'PROPFIND',
    '/caldav/:username/projects/',
    handleCalendarHomePropfind
);
registerMethod(
    'PROPFIND',
    '/caldav/:username/projects/:projectUid/',
    handleProjectPropfind
);
registerMethod(
    'PROPFIND',
    '/caldav/:username/projects/:projectUid/:uid',
    handleProjectPropfind
);
registerMethod(
    'REPORT',
    '/caldav/:username/projects/:projectUid/',
    handleProjectReport
);

// MKCOL on the projects home or a project calendar: 405 Method Not Allowed.
router.all(
    '/caldav/:username/projects/',
    xmlParser,
    caldavAuth,
    (req, res, next) => {
        if (req.method !== 'MKCOL') return next();
        res.set('Allow', 'OPTIONS, GET, HEAD, PROPFIND');
        return res.status(405).end();
    }
);
router.all(
    '/caldav/:username/projects/:projectUid/',
    xmlParser,
    caldavAuth,
    (req, res, next) => {
        if (req.method !== 'MKCOL') return next();
        res.set('Allow', 'OPTIONS, GET, HEAD, PROPFIND, REPORT');
        return res.status(405).end();
    }
);

// MKCOL on the existing tasks calendar: 405 Method Not Allowed (already exists).
router.all(
    '/caldav/:username/tasks/',
    xmlParser,
    caldavAuth,
    (req, res, next) => {
        if (req.method !== 'MKCOL') return next();
        res.set('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT');
        return res.status(405).end();
    }
);

// MKCOL inside the tasks calendar (e.g. Tasks.org creating a "list"):
// CalDAV forbids sub-collections inside a calendar collection (RFC 4791).
router.all(
    '/caldav/:username/tasks/:uid',
    xmlParser,
    caldavAuth,
    (req, res, next) => {
        if (req.method !== 'MKCOL') return next();
        return res
            .status(409)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(
                '<?xml version="1.0"?>' +
                    '<D:error xmlns:D="DAV:"><D:resource-must-be-null/></D:error>'
            );
    }
);

router.get('/caldav/:username/tasks/', xmlParser, caldavAuth, (req, res) => {
    res.status(207).send(
        '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"/>'
    );
});

router.get(
    '/caldav/:username/tasks/:uid',
    xmlParser,
    caldavAuth,
    handleGetTask
);
router.put(
    '/caldav/:username/tasks/:uid',
    xmlParser,
    caldavAuth,
    handlePutTask
);
router.delete(
    '/caldav/:username/tasks/:uid',
    xmlParser,
    caldavAuth,
    handleDeleteTask
);

// Per-project collection GET (empty 207) + item GET/PUT/DELETE. Item handlers are
// keyed by the globally-unique task uid, so the existing task-handlers work
// unchanged; handlePutTask reads :projectUid to file new tasks into the right
// project.
router.get(
    '/caldav/:username/projects/:projectUid/',
    xmlParser,
    caldavAuth,
    (req, res) => {
        res.status(207).send(
            '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"/>'
        );
    }
);
router.get(
    '/caldav/:username/projects/:projectUid/:uid',
    xmlParser,
    caldavAuth,
    handleGetTask
);
router.put(
    '/caldav/:username/projects/:projectUid/:uid',
    xmlParser,
    caldavAuth,
    handlePutTask
);
router.delete(
    '/caldav/:username/projects/:projectUid/:uid',
    xmlParser,
    caldavAuth,
    handleDeleteTask
);

router.use('/api/caldav', requireAuth, apiRoutes);

module.exports = router;
