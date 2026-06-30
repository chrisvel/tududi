// Per-project CalDAV calendars (opt-in via CALDAV_PROJECTS_AS_CALENDARS=true).
//
// Exposes one CalDAV calendar collection per project (plus a "(No Project)"
// calendar for tasks with no project) under calendar-home /caldav/<email>/projects/,
// so clients like Apple Reminders show one list per project instead of the single
// combined "Tududi Tasks" list. Reuses the existing VTODO serializer / etag / ctag
// so each collection is byte-compatible with the built-in /tasks/ collection.
//
// When the flag is off (default) these handlers 404 and nothing changes — the
// principal advertises the single tasks/ calendar exactly as before.
const {
    buildMultistatus,
    buildResponse,
    buildPropstat,
    parsePropfind,
    parseCalendarQuery,
} = require('./utils');
const { generateETag } = require('../utils/etag-generator');
const { generateCTag } = require('../utils/ctag-generator');
const taskRepository = require('../../tasks/repository');
const vtodoSerializer = require('../icalendar/vtodo-serializer');
const { Project } = require('../../../models');
const { Op } = require('sequelize');

const INBOX_UID = '__inbox__';
const INCLUDE_PROJECT = [{ model: Project, attributes: ['id', 'uid', 'name'] }];
const EMPTY_PROPFIND =
    '<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>';

function perProjectEnabled() {
    return process.env.CALDAV_PROJECTS_AS_CALENDARS === 'true';
}

const enc = encodeURIComponent;
const homeHref = (u) => `/caldav/${enc(u)}/projects/`;
const calHref = (u, p) => `/caldav/${enc(u)}/projects/${enc(p)}/`;
const itemHref = (u, p, uid) => `${calHref(u, p)}${enc(uid)}.ics`;

// Resolve a :projectUid (or the inbox sentinel) to { name, where } scoping the
// task query. Returns null if the calendar does not exist / is not the user's.
async function resolveProject(projectUid, userId) {
    if (projectUid === INBOX_UID) {
        return {
            name: '(No Project)',
            where: { project_id: { [Op.is]: null } },
        };
    }
    const project = await Project.findOne({
        where: { uid: projectUid },
        attributes: ['id', 'uid', 'user_id', 'name'],
    });
    if (!project || project.user_id !== userId) return null;
    return { name: project.name, where: { project_id: project.id } };
}

function calendarProps(displayname, ctag, username) {
    return {
        'D:resourcetype': { 'D:collection': '', 'C:calendar': '' },
        'D:displayname': displayname,
        'C:calendar-description': displayname,
        'C:supported-calendar-component-set': {
            'C:comp': { $: { name: 'VTODO' } },
        },
        'D:getcontenttype': 'text/calendar; charset=utf-8',
        'C:getctag': ctag,
        'D:current-user-principal': { 'D:href': `/caldav/${enc(username)}/` },
        'D:principal-URL': { 'D:href': `/caldav/${enc(username)}/` },
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
}

async function buildItemResponse(task, username, projectUid) {
    const href = itemHref(username, projectUid, task.uid);
    try {
        const vtodo = await vtodoSerializer.serializeTaskToVTODO(task);
        return buildResponse(
            href,
            buildPropstat({
                'D:resourcetype': '',
                'D:displayname': task.name,
                'D:getcontenttype':
                    'text/calendar; charset=utf-8; component=VTODO',
                'D:getetag': generateETag(task),
                'D:getcontentlength': Buffer.byteLength(
                    vtodo,
                    'utf8'
                ).toString(),
                'D:getlastmodified': new Date(task.updated_at).toUTCString(),
            })
        );
    } catch (error) {
        console.error(`Error building item response for ${task.uid}:`, error);
        return buildResponse(
            href,
            buildPropstat(
                { 'D:resourcetype': '', 'D:displayname': task.name },
                'HTTP/1.1 500 Internal Server Error'
            )
        );
    }
}

// PROPFIND /caldav/:username/projects/ — the calendar-home; lists one calendar
// per project plus the "(No Project)" collection.
async function handleCalendarHomePropfind(req, res) {
    if (!perProjectEnabled())
        return res.status(404).json({ error: 'Not found' });
    try {
        const { username } = req.params;
        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const userId = req.currentUser.id;
        const depth = parseInt(req.headers.depth || '0', 10);
        try {
            await parsePropfind(req.rawBody || EMPTY_PROPFIND);
        } catch (_) {
            /* tolerate */
        }

        const responses = [
            buildResponse(
                homeHref(username),
                buildPropstat({
                    'D:resourcetype': { 'D:collection': '' },
                    'D:displayname': 'Tududi Projects',
                    'D:current-user-principal': {
                        'D:href': `/caldav/${enc(username)}/`,
                    },
                })
            ),
        ];

        if (depth > 0) {
            const tasks = await taskRepository.findByUser(
                userId,
                {},
                { attributes: ['id', 'project_id', 'updated_at', 'created_at'] }
            );
            const byProject = new Map();
            for (const t of tasks) {
                const key = t.project_id == null ? null : t.project_id;
                if (!byProject.has(key)) byProject.set(key, []);
                byProject.get(key).push(t);
            }
            const projects = await Project.findAll({
                where: { user_id: userId },
                attributes: ['id', 'uid', 'name'],
                order: [['name', 'ASC']],
            });
            for (const p of projects) {
                const ctag = generateCTag(byProject.get(p.id) || []);
                responses.push(
                    buildResponse(
                        calHref(username, p.uid),
                        buildPropstat(
                            calendarProps(p.name || 'Project', ctag, username)
                        )
                    )
                );
            }
            responses.push(
                buildResponse(
                    calHref(username, INBOX_UID),
                    buildPropstat(
                        calendarProps(
                            '(No Project)',
                            generateCTag(byProject.get(null) || []),
                            username
                        )
                    )
                )
            );
        }

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(buildMultistatus(responses));
    } catch (error) {
        console.error('Calendar-home PROPFIND error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// PROPFIND /caldav/:username/projects/:projectUid/[:uid]
async function handleProjectPropfind(req, res) {
    if (!perProjectEnabled())
        return res.status(404).json({ error: 'Not found' });
    try {
        const { username, projectUid } = req.params;
        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const userId = req.currentUser.id;
        const proj = await resolveProject(projectUid, userId);
        if (!proj) return res.status(404).json({ error: 'Calendar not found' });
        const depth = parseInt(req.headers.depth || '0', 10);
        try {
            await parsePropfind(req.rawBody || EMPTY_PROPFIND);
        } catch (_) {
            /* tolerate */
        }

        const responses = [];
        if (req.params.uid) {
            const uid = req.params.uid.replace('.ics', '');
            const task = await taskRepository.findByUid(uid, {
                include: INCLUDE_PROJECT,
            });
            if (!task || task.user_id !== userId) {
                return res.status(404).json({ error: 'Task not found' });
            }
            responses.push(await buildItemResponse(task, username, projectUid));
        } else {
            const tasks = await taskRepository.findByUser(userId, proj.where, {
                include: INCLUDE_PROJECT,
            });
            responses.push(
                buildResponse(
                    calHref(username, projectUid),
                    buildPropstat(
                        calendarProps(proj.name, generateCTag(tasks), username)
                    )
                )
            );
            if (depth > 0) {
                for (const task of tasks) {
                    responses.push(
                        await buildItemResponse(task, username, projectUid)
                    );
                }
            }
        }

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(buildMultistatus(responses));
    } catch (error) {
        console.error('Project PROPFIND error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// REPORT /caldav/:username/projects/:projectUid/ (calendar-query + multiget)
async function handleProjectReport(req, res) {
    if (!perProjectEnabled())
        return res.status(404).json({ error: 'Not found' });
    try {
        const { username, projectUid } = req.params;
        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const userId = req.currentUser.id;
        const proj = await resolveProject(projectUid, userId);
        if (!proj) return res.status(404).json({ error: 'Calendar not found' });

        let queryRequest;
        try {
            queryRequest = await parseCalendarQuery(req.rawBody);
        } catch (error) {
            return res
                .status(400)
                .json({ error: 'Invalid calendar-query request' });
        }

        const responses = [];
        if (queryRequest.isMultiget) {
            for (const href of queryRequest.hrefs) {
                const match = href.match(/\/([^/]+)\.ics$/);
                if (!match) {
                    responses.push(
                        buildResponse(
                            href,
                            buildPropstat({}, 'HTTP/1.1 404 Not Found')
                        )
                    );
                    continue;
                }
                const uid = decodeURIComponent(match[1]);
                const task = await taskRepository.findByUid(uid, {
                    include: INCLUDE_PROJECT,
                });
                if (!task || task.user_id !== userId) {
                    responses.push(
                        buildResponse(
                            href,
                            buildPropstat({}, 'HTTP/1.1 404 Not Found')
                        )
                    );
                    continue;
                }
                try {
                    responses.push(
                        buildResponse(
                            href,
                            buildPropstat({
                                'D:getetag': generateETag(task),
                                'C:calendar-data':
                                    await vtodoSerializer.serializeTaskToVTODO(
                                        task
                                    ),
                            })
                        )
                    );
                } catch (error) {
                    responses.push(
                        buildResponse(
                            href,
                            buildPropstat(
                                {},
                                'HTTP/1.1 500 Internal Server Error'
                            )
                        )
                    );
                }
            }
        } else {
            const includeData = queryRequest.props.some(
                (p) => p === 'calendar-data' || p === 'C:calendar-data'
            );
            const tasks = await taskRepository.findByUser(userId, proj.where, {
                include: INCLUDE_PROJECT,
            });
            for (const task of tasks) {
                const props = { 'D:getetag': generateETag(task) };
                if (includeData) {
                    props['C:calendar-data'] =
                        await vtodoSerializer.serializeTaskToVTODO(task);
                }
                responses.push(
                    buildResponse(
                        itemHref(username, projectUid, task.uid),
                        buildPropstat(props)
                    )
                );
            }
        }

        res.status(207)
            .set('Content-Type', 'application/xml; charset=utf-8')
            .send(buildMultistatus(responses));
    } catch (error) {
        console.error('Project REPORT error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Resolve the project_id a PUT into a project collection should set (or null for
// the inbox / unknown project). Used by webdav/task-handlers.handlePutTask.
async function resolveProjectIdForPut(projectUid, userId) {
    if (!projectUid || projectUid === INBOX_UID) return null;
    const project = await Project.findOne({
        where: { uid: projectUid },
        attributes: ['id', 'user_id'],
    });
    return project && project.user_id === userId ? project.id : null;
}

module.exports = {
    INBOX_UID,
    perProjectEnabled,
    handleCalendarHomePropfind,
    handleProjectPropfind,
    handleProjectReport,
    resolveProjectIdForPut,
};
