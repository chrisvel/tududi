'use strict';

const { hasAccess } = require('../../middleware/authorize');
const {
    createAttachmentRouter,
    projectAttachments,
} = require('../../services/entityAttachments');
const { Project } = require('../../models');
const projectsController = require('./controller');

const projectUid = (req) => projectsController.getProjectUidForAuth(req);
const options = { notFoundMessage: 'Project not found.' };

// A project's own files, shown on its Attachments tab. Access follows the
// project, so people it is shared with see them too.
module.exports = createAttachmentRouter({
    basePath: '/project/:uid/attachments',
    store: projectAttachments,
    canRead: hasAccess('ro', 'project', projectUid, options),
    canWrite: hasAccess('rw', 'project', projectUid, options),
    loadOwner: async (req) =>
        Project.findOne({ where: { uid: await projectUid(req) } }),
});
