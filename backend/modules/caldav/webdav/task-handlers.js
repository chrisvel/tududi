const { generateETag } = require('../utils/etag-generator');
const entitlements = require('../../../services/entitlementsService');
const { matchesETag } = require('../utils/etag-generator');
const taskRepository = require('../../tasks/repository');
const { CALDAV_TASK_INCLUDES } = require('../task-includes');
const vtodoSerializer = require('../icalendar/vtodo-serializer');
const vtodoParser = require('../icalendar/vtodo-parser');
const { resolveProjectIdForPut } = require('./projects');
const { deleteTaskFromRemotes } = require('../services/task-deletion-service');
const { canReadTask, canWriteTask, visibleTaskWhere } = require('../access');
const { STATUS_TUDUDI_TO_ICAL } = require('../icalendar/field-mappings');
const { buildHref, resourceNameOf } = require('./utils');

// RFC 4791 5.3.2.1: a UID may be used by one resource in a calendar only.
function uidConflictResponse(res, username, task) {
    return res
        .status(409)
        .set('Content-Type', 'application/xml; charset=utf-8')
        .send(
            '<?xml version="1.0" encoding="UTF-8"?>' +
                '<D:error xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
                `<C:no-uid-conflict><D:href>${buildHref(username, resourceNameOf(task))}</D:href></C:no-uid-conflict>` +
                '</D:error>'
        );
}

async function handleGetTask(req, res) {
    try {
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const userId = req.currentUser.id;
        const resourceName = uid.replace('.ics', '');
        // Scoped to what the caller can see: a resource name is only unique to
        // the client that chose it, so an unscoped name lookup could answer
        // with another user's row of the same name.
        const task = await taskRepository.findByUidOrResourceName(
            resourceName,
            {
                include: CALDAV_TASK_INCLUDES,
                where: await visibleTaskWhere(userId),
            }
        );

        if (!(await canReadTask(task, userId))) {
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
        const resourceName = uid.replace('.ics', '');
        const vtodoData = req.rawBody;

        console.log('[PUT] rawBody:', !!vtodoData, vtodoData?.length);

        if (!vtodoData) {
            console.log('[PUT] No data provided');
            return res.status(400).send('Bad Request: No data provided');
        }

        const existingTask = await taskRepository.findByUidOrResourceName(
            resourceName,
            {
                include: CALDAV_TASK_INCLUDES,
                where: await visibleTaskWhere(userId),
            }
        );

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

        // RFC 4791 5.3.2: the URL of a calendar object resource is arbitrary
        // and need not match the UID inside it. The UID the client sent is the
        // task's identity; the name it uploaded under is only its URL, and both
        // are kept (see caldav_resource_name). Reading the URL as the identity
        // made a client see its own task change identity after every upload,
        // re-upload it, and leave a row behind each time (#1371).
        const clientUid = taskData.uid ? String(taskData.uid).trim() : null;

        if (clientUid) {
            // A UID belongs to one resource in a calendar collection, so an
            // upload that would give it a second one is refused rather than
            // stored as another row for the same task - the duplicate that made
            // deleting a task pointless.
            const uidOwner = await taskRepository.findByUid(clientUid);

            if (
                uidOwner &&
                (!existingTask || uidOwner.id !== existingTask.id)
            ) {
                if (await canReadTask(uidOwner, userId)) {
                    return uidConflictResponse(res, username, uidOwner);
                }
                // Someone else's task owns this UID. Refuse without naming it:
                // that href is a uid the caller has no business seeing.
                return res
                    .status(409)
                    .json({ error: 'This UID is already in use' });
            }

            // The URL already answers with a task that has a different uid: the
            // request would change the UID of an existing resource, which the
            // spec refuses as plainly as it refuses a duplicate UID.
            if (existingTask && existingTask.uid !== clientUid) {
                return uidConflictResponse(res, username, existingTask);
            }

            taskData.uid = clientUid;
            if (resourceName !== clientUid) {
                taskData.caldav_resource_name = resourceName;
            }
        } else if (existingTask) {
            // No UID in the object and the URL already answers with a task:
            // keep the uid that row has. Taking the URL as the identity is what
            // made a client see its own task change identity after every
            // upload and re-upload it (#1371), so a re-upload that arrives
            // without a UID must not rewrite it either.
            delete taskData.uid;
        } else {
            // No UID and no row yet - the URL is all there is to identify this
            // resource by, which is what this always did.
            taskData.uid = resourceName;
        }

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

        const userId = req.currentUser.id;
        const resourceName = uid.replace('.ics', '');
        const task = await taskRepository.findByUidOrResourceName(
            resourceName,
            {
                include: CALDAV_TASK_INCLUDES,
                where: await visibleTaskWhere(userId),
            }
        );

        if (!task) {
            return res.status(404).send('Not Found');
        }

        if (!(await canWriteTask(task, userId))) {
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
