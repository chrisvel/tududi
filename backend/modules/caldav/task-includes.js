const { Project, Tag, Task } = require('../../models');

// Associations the VTODO serializer depends on.
//
// vtodo-serializer.js emits:
//   CATEGORIES + X-TUDUDI-TAG-UIDS   when task.Tags is populated
//   RELATED-TO;RELTYPE=PARENT        when task.parent_task_id && task.ParentTask
//   X-TUDUDI-PROJECT-UID             when task.Project is populated
//
// Without eager loading these associations the serializer silently skips those
// properties, so tags and parent links never reach CalDAV clients.
const CALDAV_TASK_INCLUDES = [
    { model: Project, attributes: ['id', 'uid', 'name'] },
    {
        model: Tag,
        attributes: ['id', 'uid', 'name'],
        through: { attributes: [] },
    },
    { model: Task, as: 'ParentTask', attributes: ['id', 'uid'] },
];

module.exports = { CALDAV_TASK_INCLUDES };
