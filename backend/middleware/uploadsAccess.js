const { TaskAttachment, Task, Project } = require('../models');
const permissionsService = require('../services/permissionsService');
const { getAuthenticatedUserId } = require('../utils/request-utils');

const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };

// Categories that are intentionally readable by any authenticated user once
// requireAuth has run, because they aren't scoped to a single task/project
// (e.g. avatars are shown to any collaborator across shared projects).
const PUBLIC_TO_AUTHENTICATED_USERS = new Set(['avatars']);

const hasReadAccess = async (userId, resourceType, resourceUid) => {
    const access = await permissionsService.getAccess(
        userId,
        resourceType,
        resourceUid
    );
    return LEVELS[access] >= LEVELS.ro;
};

const canAccessTaskFile = async (userId, filename) => {
    const attachment = await TaskAttachment.findOne({
        where: { stored_filename: filename },
        include: [{ model: Task, required: true }],
    });
    if (!attachment) return false;
    return hasReadAccess(userId, 'task', attachment.Task.uid);
};

const canAccessProjectFile = async (userId, filename) => {
    const project = await Project.findOne({
        where: { image_url: `/api/uploads/projects/${filename}` },
        attributes: ['uid'],
    });
    if (!project) return false;
    return hasReadAccess(userId, 'project', project.uid);
};

// Uploaded files (task attachments, project images) may belong to a
// different user than the one making the request. Being logged in is not
// enough to read them - access must be scoped to the resource the file
// belongs to, matching the checks the /attachments/:uid/download endpoint
// already performs (GHSA-49fc-pf7x-cj8x).
const uploadsAccessControl = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const segments = req.path.split('/').filter(Boolean);
        const [category, filename] = segments;

        if (PUBLIC_TO_AUTHENTICATED_USERS.has(category)) {
            return next();
        }

        let allowed = false;
        if (category === 'tasks' && filename) {
            allowed = await canAccessTaskFile(userId, filename);
        } else if (category === 'projects' && filename) {
            allowed = await canAccessProjectFile(userId, filename);
        }

        if (!allowed) {
            return res
                .status(403)
                .json({ error: 'Not authorized to access this file' });
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = { uploadsAccessControl };
