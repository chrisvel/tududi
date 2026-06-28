const {
    buildMultistatus,
    buildResponse,
    buildPropstat,
    parsePropfind,
} = require('../webdav/utils');

function handleWellKnown(req, res) {
    const protocol = req.protocol;
    const host = req.get('host');
    const redirectUrl = `${protocol}://${host}/caldav/`;

    res.redirect(301, redirectUrl);
}

async function handleRootPropfind(req, res) {
    try {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const username = req.currentUser.email;

        let propfindRequest;
        try {
            propfindRequest = await parsePropfind(
                req.rawBody ||
                    '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
            );
        } catch (error) {
            console.error('PROPFIND parse error:', error);
            return res.status(400).json({ error: 'Invalid PROPFIND request' });
        }

        const href = '/caldav/';
        const props = {
            'D:current-user-principal': {
                'D:href': `/caldav/${encodeURIComponent(username)}/`,
            },
            'D:resourcetype': {
                'D:collection': '',
            },
        };

        const propstat = buildPropstat(props);
        const response = buildResponse(href, propstat);
        const xml = buildMultistatus([response]);

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(xml);
    } catch (error) {
        console.error('Root PROPFIND handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handlePrincipalPropfind(req, res) {
    try {
        const { username } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        let propfindRequest;
        try {
            propfindRequest = await parsePropfind(
                req.rawBody ||
                    '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'
            );
        } catch (error) {
            console.error('PROPFIND parse error:', error);
            return res.status(400).json({ error: 'Invalid PROPFIND request' });
        }

        const depth = parseInt(req.headers.depth || '0', 10);
        const principalHref = `/caldav/${encodeURIComponent(username)}/`;

        const props = {
            'D:resourcetype': {
                'D:collection': '',
                'D:principal': '',
            },
            // Point home-set to the principal itself so clients doing a
            // depth-1 PROPFIND on it discover the tasks/ calendar as a child.
            'C:calendar-home-set': {
                'D:href': principalHref,
            },
            'D:current-user-principal': {
                'D:href': principalHref,
            },
            'D:displayname': username,
        };

        const propstat = buildPropstat(props);
        const response = buildResponse(principalHref, propstat);
        const responses = [response];

        // Depth-1: expose the tasks calendar as a child of the home set so
        // clients like Tasks.org can discover it without creating a new list.
        if (depth >= 1) {
            const tasksHref = `/caldav/${encodeURIComponent(username)}/tasks/`;
            const tasksProps = {
                'D:resourcetype': {
                    'D:collection': '',
                    'C:calendar': '',
                },
                'D:displayname': 'Tududi Tasks',
                'C:calendar-description': 'Tasks from Tududi',
                'C:supported-calendar-component-set': {
                    'C:comp': { $: { name: 'VTODO' } },
                },
            };
            responses.push(buildResponse(tasksHref, buildPropstat(tasksProps)));
        }

        const xml = buildMultistatus(responses);

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(xml);
    } catch (error) {
        console.error('Principal PROPFIND handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    handleWellKnown,
    handleRootPropfind,
    handlePrincipalPropfind,
};
