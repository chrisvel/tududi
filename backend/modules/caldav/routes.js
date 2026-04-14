const express = require('express');
const caldavAuth = require('./middleware/caldav-auth');
const xmlParser = require('./middleware/xml-parser');
const { handleWellKnown } = require('./protocol/discovery');
const { handleOptions } = require('./webdav/options');
const { handlePropfind } = require('./webdav/propfind');
const { handleReport } = require('./webdav/report');
const {
    handleGetTask,
    handlePutTask,
    handleDeleteTask,
} = require('./webdav/task-handlers');

const router = express.Router();

router.get('/.well-known/caldav', handleWellKnown);

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

function registerMethod(method, path, handler) {
    router.all(path, xmlParser, caldavAuth, (req, res, next) => {
        if (req.method === method) {
            return handler(req, res, next);
        }
        next();
    });
}

registerMethod('PROPFIND', '/caldav/:username/tasks/', handlePropfind);
registerMethod('PROPFIND', '/caldav/:username/tasks/:uid', handlePropfind);

registerMethod('REPORT', '/caldav/:username/tasks/', handleReport);

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

module.exports = router;
