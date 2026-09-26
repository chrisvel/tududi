const { Op } = require('sequelize');
const {
    TaskAttachment,
    InboxItemAttachment,
    Task,
    Project,
    User,
} = require('../models');
const permissionsService = require('../services/permissionsService');
const permissionSources = require('../services/permissionSources');
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

// Inbox items are never shared, so only the owner can read their files.
const canAccessInboxFile = async (userId, filename) => {
    const attachment = await InboxItemAttachment.findOne({
        where: { stored_filename: filename },
        attributes: ['user_id'],
        raw: true,
    });
    return !!attachment && attachment.user_id === userId;
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
    const directShare = await permissionSources.countAccepted({
        [Op.or]: [
            { user_id: userId, granted_by_user_id: otherUserId },
            { user_id: otherUserId, granted_by_user_id: userId },
        ],
    });
    if (directShare > 0) return true;

    const mine = await permissionSources.findAccepted({ user_id: userId }, [
        'resource_uid',
    ]);
    if (mine.length === 0) return false;

    const common = await permissionSources.countAccepted({
        user_id: otherUserId,
        resource_uid: { [Op.in]: mine.map((p) => p.resource_uid) },
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
//
// express.static decodes and normalizes the path after this check runs, so
// the check has to see the same path the static handler will serve. Anything
// that isn't exactly /<category>/<filename> after one round of decoding is
// refused, otherwise "/tasks/<my-file>/../<their-file>" passes the check for
// my file and then resolves to theirs.
const resolveUploadTarget = (rawPath) => {
    let decoded;
    try {
        decoded = decodeURIComponent(rawPath);
    } catch (_) {
        return null;
    }
    if (decoded.includes('\0') || decoded.includes('\\')) return null;

    const segments = decoded.split('/').filter(Boolean);
    if (segments.length !== 2) return null;
    if (segments.some((segment) => segment === '.' || segment === '..')) {
        return null;
    }

    return { category: segments[0], filename: segments[1] };
};

const uploadsAccessControl = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const target = resolveUploadTarget(req.path);

        let allowed = false;
        const { category, filename } = target || {};
        if (category === 'tasks' && filename) {
            allowed = await canAccessTaskFile(userId, filename);
        } else if (category === 'inbox' && filename) {
            allowed = await canAccessInboxFile(userId, filename);
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

module.exports = { uploadsAccessControl, resolveUploadTarget };
