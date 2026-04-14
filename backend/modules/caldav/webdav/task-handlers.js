const { generateETag } = require('../utils/etag-generator');
const { matchesETag } = require('../utils/etag-generator');
const taskRepository = require('../../tasks/repository');
const vtodoSerializer = require('../icalendar/vtodo-serializer');
const vtodoParser = require('../icalendar/vtodo-parser');
const syncStateRepository = require('../repositories/sync-state-repository');
const { nanoid } = require('nanoid');

async function handleGetTask(req, res) {
    try {
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const taskUid = uid.replace('.ics', '');
        const task = await taskRepository.findByUid(taskUid);

        if (!task || task.user_id !== req.currentUser.id) {
            return res.status(404).send('Not Found');
        }

        const etag = generateETag(task);
        const ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch && matchesETag(ifNoneMatch, etag)) {
            return res.status(304).end();
        }

        const vtodo = await vtodoSerializer.serialize(task);

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
        const { username, uid } = req.params;

        if (!req.currentUser || req.currentUser.email !== username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const userId = req.currentUser.id;
        const taskUid = uid.replace('.ics', '');
        const vtodoData = req.rawBody;

        if (!vtodoData) {
            return res.status(400).send('Bad Request: No data provided');
        }

        const existingTask = await taskRepository.findByUid(taskUid);

        if (existingTask && existingTask.user_id !== userId) {
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
            taskData = await vtodoParser.parse(vtodoData);
        } catch (error) {
            console.error('VTODO parse error:', error);
            return res.status(400).send('Bad Request: Invalid VTODO data');
        }

        taskData.uid = taskUid;
        taskData.user_id = userId;

        let task;
        if (existingTask) {
            await existingTask.update(taskData);
            task = existingTask;
        } else {
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
        const task = await taskRepository.findByUid(taskUid);

        if (!task) {
            return res.status(404).send('Not Found');
        }

        if (task.user_id !== req.currentUser.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const ifMatch = req.headers['if-match'];
        if (ifMatch) {
            const currentEtag = generateETag(task);
            if (!matchesETag(ifMatch, currentEtag)) {
                return res.status(412).send('Precondition Failed');
            }
        }

        await taskRepository.delete(task.id, req.currentUser.id);

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
