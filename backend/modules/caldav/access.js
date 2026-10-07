const { Project } = require('../../models');
const permissionsService = require('../../services/permissionsService');

const { ACCESS } = permissionsService;

// CalDAV shows the same tasks the web app does (#1715): the caller's own,
// tasks shared with them or living in a project shared with them, and tasks
// assigned to them. Reading needs any access, changing a task needs RW.

function visibleTaskWhere(userId) {
    return permissionsService.ownershipOrPermissionWhere('task', userId);
}

async function taskAccess(task, userId) {
    if (!task) return ACCESS.NONE;
    if (task.user_id === userId) return ACCESS.RW;
    return permissionsService.getAccess(userId, 'task', task.uid);
}

async function canReadTask(task, userId) {
    return (await taskAccess(task, userId)) !== ACCESS.NONE;
}

async function canWriteTask(task, userId) {
    const access = await taskAccess(task, userId);
    return access === ACCESS.RW || access === ACCESS.ADMIN;
}

async function visibleProjects(userId) {
    return Project.findAll({
        where: await permissionsService.ownershipOrPermissionWhere(
            'project',
            userId
        ),
        attributes: ['id', 'uid', 'name', 'user_id'],
        order: [['name', 'ASC']],
    });
}

async function projectAccess(project, userId) {
    if (!project) return ACCESS.NONE;
    if (project.user_id === userId) return ACCESS.RW;
    return permissionsService.getAccess(userId, 'project', project.uid);
}

function isWritable(access) {
    return access === ACCESS.RW || access === ACCESS.ADMIN;
}

module.exports = {
    ACCESS,
    visibleTaskWhere,
    canReadTask,
    canWriteTask,
    visibleProjects,
    projectAccess,
    isWritable,
};
