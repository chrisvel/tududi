const {
    parsePropfind,
    buildMultistatus,
    buildResponse,
    buildPropstat,
    buildHref,
} = require('./utils');
const { generateETag } = require('../utils/etag-generator');
const { generateCTag } = require('../utils/ctag-generator');
const calendarRepository = require('../repositories/calendar-repository');
const taskRepository = require('../../tasks/repository');
const vtodoSerializer = require('../icalendar/vtodo-serializer');

async function handlePropfind(req, res) {
    try {
        const { username } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const userId = req.currentUser.id;
        const depth = parseInt(req.headers.depth || '0', 10);

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

        const isTaskRequest = req.params.uid;
        const responses = [];

        if (isTaskRequest) {
            const taskUid = req.params.uid.replace('.ics', '');
            const task = await taskRepository.findByUid(taskUid);

            if (!task || task.user_id !== userId) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const response = await buildTaskResponse(
                task,
                username,
                propfindRequest
            );
            responses.push(response);
        } else {
            const calendarResponse = await buildCalendarResponse(
                username,
                userId,
                propfindRequest
            );
            responses.push(calendarResponse);

            if (depth > 0) {
                const tasks = await taskRepository.findByUser(userId);
                for (const task of tasks) {
                    const taskResponse = await buildTaskResponse(
                        task,
                        username,
                        propfindRequest
                    );
                    responses.push(taskResponse);
                }
            }
        }

        const xml = buildMultistatus(responses);

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(xml);
    } catch (error) {
        console.error('PROPFIND handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function buildCalendarResponse(username, userId, propfindRequest) {
    const href = buildHref(username);
    const tasks = await taskRepository.findByUser(userId);
    const ctag = generateCTag(tasks);

    const props = {
        'D:resourcetype': {
            'D:collection': '',
            'C:calendar': '',
        },
        'D:displayname': 'TaskNoteTaker Tasks',
        'C:calendar-description': 'Tasks from TaskNoteTaker',
        'C:supported-calendar-component-set': {
            'C:comp': {
                $: { name: 'VTODO' },
            },
        },
        'D:getcontenttype': 'text/calendar; charset=utf-8',
        'C:getctag': ctag,
        'D:current-user-privilege-set': {
            'D:privilege': [
                { 'D:read': '' },
                { 'D:write': '' },
                { 'D:write-content': '' },
                { 'D:bind': '' },
                { 'D:unbind': '' },
            ],
        },
    };

    const propstat = buildPropstat(props);
    return buildResponse(href, propstat);
}

async function buildTaskResponse(task, username, propfindRequest) {
    const href = buildHref(username, task.uid);
    const etag = generateETag(task);

    try {
        const vtodo = await vtodoSerializer.serializeTaskToVTODO(task);

        const props = {
            'D:resourcetype': '',
            'D:displayname': task.name,
            'D:getcontenttype': 'text/calendar; charset=utf-8; component=VTODO',
            'D:getetag': etag,
            'D:getcontentlength': Buffer.byteLength(vtodo, 'utf8').toString(),
            'D:getlastmodified': new Date(task.updated_at).toUTCString(),
        };

        const propstat = buildPropstat(props);
        return buildResponse(href, propstat);
    } catch (error) {
        console.error(`Error building task response for ${task.uid}:`, error);
        const errorProps = {
            'D:resourcetype': '',
            'D:displayname': task.name,
        };
        const propstat = buildPropstat(
            errorProps,
            'HTTP/1.1 500 Internal Server Error'
        );
        return buildResponse(href, propstat);
    }
}

module.exports = {
    handlePropfind,
};
