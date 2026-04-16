const {
    parseCalendarQuery,
    buildMultistatus,
    buildResponse,
    buildPropstat,
    buildHref,
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

            const parseICalDate = (dateStr) => {
                if (!dateStr) return null;
                if (dateStr.length === 16 && dateStr.endsWith('Z')) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    const hour = dateStr.substring(9, 11);
                    const minute = dateStr.substring(11, 13);
                    const second = dateStr.substring(13, 15);
                    return new Date(
                        `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
                    );
                }
                return new Date(dateStr);
            };

            if (start || end) {
                where.due_date = {};
                if (start) {
                    where.due_date[Op.gte] = parseICalDate(start);
                }
                if (end) {
                    where.due_date[Op.lte] = parseICalDate(end);
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
            const vtodo = await vtodoSerializer.serializeTaskToVTODO(task);
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
