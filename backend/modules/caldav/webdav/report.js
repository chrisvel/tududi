const {
    parseCalendarQuery,
    buildMultistatus,
    buildResponse,
    buildPropstat,
    buildHref,
    buildCalendarData,
} = require('./utils');
const { generateETag } = require('../utils/etag-generator');
const taskRepository = require('../../tasks/repository');
const vtodoSerializer = require('../icalendar/vtodo-serializer');
const { Op } = require('sequelize');

async function handleReport(req, res) {
    try {
        const { username } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const userId = req.currentUser.id;

        let queryRequest;
        try {
            queryRequest = await parseCalendarQuery(req.rawBody);
        } catch (error) {
            console.error('REPORT parse error:', error);
            return res
                .status(400)
                .json({ error: 'Invalid calendar-query request' });
        }

        const where = { user_id: userId };

        if (queryRequest.filters.timeRange) {
            const { start, end } = queryRequest.filters.timeRange;

            if (start || end) {
                where.due_date = {};
                if (start) {
                    where.due_date[Op.gte] = new Date(start);
                }
                if (end) {
                    where.due_date[Op.lte] = new Date(end);
                }
            }
        }

        if (queryRequest.filters.textMatch) {
            const { property, value, caseless } =
                queryRequest.filters.textMatch;

            if (property === 'SUMMARY') {
                where.name = caseless
                    ? { [Op.like]: `%${value}%` }
                    : { [Op.substring]: value };
            }
        }

        const tasks = await taskRepository.findAll(where);

        const responses = [];
        for (const task of tasks) {
            const response = await buildCalendarQueryResponse(
                task,
                username,
                queryRequest
            );
            if (response) {
                responses.push(response);
            }
        }

        const xml = buildMultistatus(responses);

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(xml);
    } catch (error) {
        console.error('REPORT handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function buildCalendarQueryResponse(task, username, queryRequest) {
    try {
        const href = buildHref(username, task.uid);
        const etag = generateETag(task);

        const props = {
            'D:getetag': etag,
        };

        const includeCalendarData = queryRequest.props.some(
            (prop) => prop === 'calendar-data' || prop === 'C:calendar-data'
        );

        if (includeCalendarData) {
            const vtodo = await vtodoSerializer.serialize(task);
            props['C:calendar-data'] = vtodo;
        }

        const propstat = buildPropstat(props);
        return buildResponse(href, propstat);
    } catch (error) {
        console.error(
            `Error building calendar-query response for ${task.uid}:`,
            error
        );
        return null;
    }
}

module.exports = {
    handleReport,
};
