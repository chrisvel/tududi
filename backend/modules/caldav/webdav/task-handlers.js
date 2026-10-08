const { generateETag } = require('../utils/etag-generator');
const entitlements = require('../../../services/entitlementsService');
const { matchesETag } = require('../utils/etag-generator');
const taskRepository = require('../../tasks/repository');
const { CALDAV_TASK_INCLUDES } = require('../task-includes');
const vtodoSerializer = require('../icalendar/vtodo-serializer');
const vtodoParser = require('../icalendar/vtodo-parser');
const { resolveProjectIdForPut } = require('./projects');
const { deleteTaskFromRemotes } = require('../services/task-deletion-service');
const { canReadTask, canWriteTask } = require('../access');
const { STATUS_TUDUDI_TO_ICAL } = require('../icalendar/field-mappings');
const { buildHref } = require('./utils');

// RFC 4791 5.3.2.1: a UID may be used by one resource in a calendar only.
function uidConflictResponse(res, username, task) {
    return res
        .status(409)
        .set('Content-Type', 'application/xml; charset=utf-8')
        .send(
            '<?xml version="1.0" encoding="UTF-8"?>' +
                '<D:error xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
                `<C:no-uid-conflict><D:href>${buildHref(username, task.uid)}</D:href></C:no-uid-conflict>` +
                '</D:error>'
        );
}

async function handleGetTask(req, res) {
    try {
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const taskUid = uid.replace('.ics', '');
        const task = await taskRepository.findByUid(taskUid, {
            include: CALDAV_TASK_INCLUDES,
        });

        if (!(await canReadTask(task, req.currentUser.id))) {
            return res.status(404).send('Not Found');
        }

        const etag = generateETag(task);
        const ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch && matchesETag(ifNoneMatch, etag)) {
            // RFC 7232 §4.1: a 304 SHOULD echo the ETag so the client can
            // confirm which version it already has cached.
            return res.status(304).set('ETag', etag).end();
        }

        const userTimezone = req.currentUser.timezone || 'UTC';
        const vtodo = await vtodoSerializer.serializeTaskToVTODO(task, {
            userTimezone,
        });

        res.status(200)
            .set({
                'Content-Type': 'text/calendar; charset=utf-8; component=VTODO',
                ETag: etag,
                'Last-Modified': new Date(task.updated_at).toUTCString(),
            })
            .send(vtodo);
    } catch (error) {
        console.error('GET task error:', error);
        return res.status(500).send('Internal Server Error');
    }
}

async function handlePutTask(req, res) {
    try {
        console.log('[PUT] Handler reached');
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            console.log('[PUT] Forbidden - user mismatch');
            return res.status(403).json({ error: 'Forbidden' });
        }

        const userId = req.currentUser.id;
        const taskUid = uid.replace('.ics', '');
        const vtodoData = req.rawBody;

        console.log('[PUT] rawBody:', !!vtodoData, vtodoData?.length);

        if (!vtodoData) {
            console.log('[PUT] No data provided');
            return res.status(400).send('Bad Request: No data provided');
        }

        const existingTask = await taskRepository.findByUid(taskUid, {
            include: CALDAV_TASK_INCLUDES,
        });

        if (existingTask && !(await canWriteTask(existingTask, userId))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const ifMatch = req.headers['if-match'];
        if (existingTask && ifMatch) {
            const currentEtag = generateETag(existingTask);
            if (!matchesETag(ifMatch, currentEtag)) {
                return res.status(412).send('Precondition Failed');
            }
        }

        let taskData;
        try {
            const userTimezone = req.currentUser.timezone || 'UTC';
            taskData = await vtodoParser.parseVTODOToTask(
                vtodoData,
                userTimezone
            );
        } catch (error) {
            console.error('VTODO parse error:', error);
            return res.status(400).send('Bad Request: Invalid VTODO data');
        }

        // The resource is addressed by its filename. A client that uploads a
        // VTODO under a new filename while its UID already belongs to another
        // task would get a second row for the same task, so refuse it the way
        // the spec says to, pointing the client at the existing resource.
        if (!existingTask && taskData.uid && taskData.uid !== taskUid) {
            const uidOwner = await taskRepository.findByUid(taskData.uid);
            if (uidOwner && (await canReadTask(uidOwner, userId))) {
                return uidConflictResponse(res, username, uidOwner);
            }
        }

        taskData.uid = taskUid;
        // An edit by a collaborator keeps the task with its owner.
        taskData.user_id = existingTask ? existingTask.user_id : userId;
        // Only the sync engine uses LAST-MODIFIED.
        delete taskData.last_modified;

        if (existingTask) {
            // iCalendar has fewer statuses than Tududi (planned, waiting and
            // archived have no VTODO equivalent). When the client sends back
            // the status it was given, keep the Tududi one instead of
            // resetting a planned or waiting task to "not started".
            if (
                STATUS_TUDUDI_TO_ICAL[existingTask.status] ===
                STATUS_TUDUDI_TO_ICAL[taskData.status]
            ) {
                taskData.status = existingTask.status;
                if (!taskData.completed_at) {
                    taskData.completed_at = existingTask.completed_at;
                }
            }
            // Order is a Tududi-only property; a client that drops it should
            // not reset the task's position.
            if (taskData.order === null || Number.isNaN(taskData.order)) {
                delete taskData.order;
            }
        }

        // Per-project route: file the task into the URL's project (or null for
        // the "(No Project)" calendar). This also fixes the case where the
        // VTODO's x-tududi-project-uid is parsed into taskData.project_uid but
        // never mapped to project_id (Sequelize silently drops the unknown key).
        if (req.params.projectUid !== undefined) {
            taskData.project_id = await resolveProjectIdForPut(
                req.params.projectUid,
                userId
            );
        }
        delete taskData.project_uid;

        let task;
        if (existingTask) {
            await existingTask.update(taskData);
            task = existingTask;
        } else {
            await entitlements.assertCanCreate(userId, 'task');
            task = await taskRepository.create(taskData);
        }

        const etag = generateETag(task);

        res.status(existingTask ? 204 : 201)
            .set({
                ETag: etag,
                'Last-Modified': new Date(task.updated_at).toUTCString(),
            })
            .end();
    } catch (error) {
        console.error('PUT task error:', error);
        return res.status(500).send('Internal Server Error');
    }
}

async function handleDeleteTask(req, res) {
    try {
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const taskUid = uid.replace('.ics', '');
        const task = await taskRepository.findByUid(taskUid, {
            include: CALDAV_TASK_INCLUDES,
        });

        if (!task) {
            return res.status(404).send('Not Found');
        }

        if (!(await canWriteTask(task, req.currentUser.id))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentEtag = generateETag(task);
            if (!matchesETag(ifMatch, currentEtag)) {
                return res.status(412).send('Precondition Failed');
            }
        }

        // Same reason as the REST delete route: a task removed here must also be
        // removed from any CalDAV server Tududi pulls it from, or the next sync
        // re-creates it (#1371).
        try {
            await deleteTaskFromRemotes(task);
        } catch (error) {
            console.error('CalDAV remote delete error:', error);
        }

        await taskRepository.delete(task.id, task.user_id);

        res.status(204).end();
    } catch (error) {
        console.error('DELETE task error:', error);
        return res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    handleGetTask,
    handlePutTask,
    handleDeleteTask,
};
