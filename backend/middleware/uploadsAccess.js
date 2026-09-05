const { Op } = require('sequelize');
const {
    TaskAttachment,
    Task,
    Project,
    User,
    Permission,
} = require('../models');
const permissionsService = require('../services/permissionsService');
const { getAuthenticatedUserId } = require('../utils/request-utils');

const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };

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

// Two users are collaborators when either has accepted a share from the
// other, or both hold accepted access to the same shared resource.
const areCollaborators = async (userId, otherUserId) => {
    const directShare = await Permission.count({
        where: {
            status: 'accepted',
            [Op.or]: [
                { user_id: userId, granted_by_user_id: otherUserId },
                { user_id: otherUserId, granted_by_user_id: userId },
            ],
        },
    });
    if (directShare > 0) return true;

    const mine = await Permission.findAll({
        where: { user_id: userId, status: 'accepted' },
        attributes: ['resource_uid'],
        raw: true,
    });
    if (mine.length === 0) return false;

    const common = await Permission.count({
        where: {
            user_id: otherUserId,
            status: 'accepted',
            resource_uid: { [Op.in]: mine.map((p) => p.resource_uid) },
        },
    });
    return common > 0;
};

// Avatars are visible to their owner and to people the owner collaborates
// with. On a shared instance "any logged-in user" would let strangers browse
// each other's photos.
const canAccessAvatarFile = async (userId, filename) => {
    const owner = await User.findOne({
        where: { avatar_image: { [Op.like]: `%/avatars/${filename}` } },
        attributes: ['id'],
        raw: true,
    });
    if (!owner) return false;
    if (owner.id === userId) return true;
    return areCollaborators(userId, owner.id);
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

        let allowed = false;
        if (category === 'tasks' && filename) {
            allowed = await canAccessTaskFile(userId, filename);
        } else if (category === 'projects' && filename) {
            allowed = await canAccessProjectFile(userId, filename);
        } else if (category === 'avatars' && filename) {
            allowed = await canAccessAvatarFile(userId, filename);
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
