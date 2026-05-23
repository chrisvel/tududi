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

        const href = `/caldav/${encodeURIComponent(username)}/`;
        const props = {
            'D:resourcetype': {
                'D:collection': '',
                'D:principal': '',
            },
            'C:calendar-home-set': {
                'D:href': `/caldav/${encodeURIComponent(username)}/tasks/`,
            },
            'D:current-user-principal': {
                'D:href': `/caldav/${encodeURIComponent(username)}/`,
            },
            'D:displayname': username,
        };

        const propstat = buildPropstat(props);
        const response = buildResponse(href, propstat);
        const xml = buildMultistatus([response]);

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
