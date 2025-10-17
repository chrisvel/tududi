const express = require('express');
const { User, Permission, Project, Task, Note } = require('../models');
const { execAction } = require('../services/execAction');
const { logError, logInfo } = require('../services/logService');
const { sendEmail } = require('../services/emailService');
const router = express.Router();

const permissionsService = require('../services/permissionsService');
const { isAdmin } = require('../services/rolesService');

// Helper function to check if user is the actual owner of a resource
async function isResourceOwner(userId, resourceType, resourceUid) {
    let resource = null;

    if (resourceType === 'project') {
        resource = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
    } else if (resourceType === 'task') {
        resource = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
    } else if (resourceType === 'note') {
        resource = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
    }

    return resource && resource.user_id === userId;
}

// Helper function to get resource details for email notifications
async function getResourceDetails(resourceType, resourceUid) {
    if (resourceType === 'project') {
        const project = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['name', 'description', 'user_id'],
        });
        return project
            ? {
                  name: project.name,
                  description: project.description,
                  ownerId: project.user_id,
              }
            : null;
    } else if (resourceType === 'task') {
        const task = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['name', 'description', 'user_id'],
        });
        return task
            ? {
                  name: task.name,
                  description: task.description,
                  ownerId: task.user_id,
              }
            : null;
    } else if (resourceType === 'note') {
        const note = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['title', 'user_id'],
        });
        return note
            ? { name: note.title, description: null, ownerId: note.user_id }
            : null;
    }
    return null;
}

// Helper function to send share notification email
async function sendShareNotificationEmail(
    targetUser,
    ownerUser,
    resourceType,
    resourceDetails,
    accessLevel,
    isRevoke = false
) {
    if (!targetUser.email) {
        logInfo(
            `Cannot send share notification to user ${targetUser.id}: no email address`
        );
        return;
    }

    const action = isRevoke ? 'revoked' : 'granted';
    const subject = isRevoke
        ? `Access removed: ${resourceType} "${resourceDetails.name}"`
        : `Shared with you: ${resourceType} "${resourceDetails.name}"`;

    const text = isRevoke
        ? `Hello,\n\n${ownerUser.email} has removed your access to the ${resourceType} "${resourceDetails.name}".\n\nYou will no longer be able to view or edit this ${resourceType}.\n\nBest regards,\nTududi`
        : `Hello,\n\n${ownerUser.email} has shared a ${resourceType} with you.\n\nResource: ${resourceDetails.name}\nAccess level: ${accessLevel}\n${resourceDetails.description ? `\nDescription: ${resourceDetails.description}` : ''}\n\nYou can now view and collaborate on this ${resourceType} in your Tududi account.\n\nBest regards,\nTududi`;

    const html = isRevoke
        ? `<p>Hello,</p><p><strong>${ownerUser.email}</strong> has removed your access to the ${resourceType} <strong>"${resourceDetails.name}"</strong>.</p><p>You will no longer be able to view or edit this ${resourceType}.</p><p>Best regards,<br>Tududi</p>`
        : `<p>Hello,</p><p><strong>${ownerUser.email}</strong> has shared a ${resourceType} with you.</p><p><strong>Resource:</strong> ${resourceDetails.name}<br><strong>Access level:</strong> ${accessLevel}${resourceDetails.description ? `<br><strong>Description:</strong> ${resourceDetails.description}` : ''}</p><p>You can now view and collaborate on this ${resourceType} in your Tududi account.</p><p>Best regards,<br>Tududi</p>`;

    await sendEmail({
        to: targetUser.email,
        subject,
        text,
        html,
    });
}

// POST /api/shares
router.post('/shares', async (req, res) => {
    try {
        const { resource_type, resource_uid, target_user_email, access_level } =
            req.body;
        if (
            !resource_type ||
            !resource_uid ||
            !target_user_email ||
            !access_level
        ) {
            return res.status(400).json({ error: 'Missing parameters' });
        }
        // Only owner (or admin) can grant shares
        const userIsAdmin = await isAdmin(req.session.userId);
        const userIsOwner = await isResourceOwner(
            req.session.userId,
            resource_type,
            resource_uid
        );
        if (!userIsAdmin && !userIsOwner) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const target = await User.findOne({
            where: { email: target_user_email },
        });
        if (!target)
            return res.status(404).json({ error: 'Target user not found' });

        // Prevent sharing with the owner (owner already has full access)
        const resource = await (async () => {
            if (resource_type === 'project') {
                return await Project.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'task') {
                return await Task.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'note') {
                return await Note.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            }
            return null;
        })();

        if (!resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        if (resource.user_id === target.id) {
            return res.status(400).json({
                error: 'Cannot grant permissions to the owner. Owner already has full access.',
            });
        }

        await execAction({
            verb: 'share_grant',
            actorUserId: req.session.userId,
            targetUserId: target.id,
            resourceType: resource_type,
            resourceUid: resource_uid,
            accessLevel: access_level,
        });

        // Send email notification to the target user
        try {
            const resourceDetails = await getResourceDetails(
                resource_type,
                resource_uid
            );
            if (resourceDetails) {
                const ownerUser = await User.findByPk(req.session.userId, {
                    attributes: ['email'],
                });
                if (ownerUser) {
                    await sendShareNotificationEmail(
                        target,
                        ownerUser,
                        resource_type,
                        resourceDetails,
                        access_level,
                        false
                    );
                }
            }
        } catch (emailError) {
            logError(emailError, 'Failed to send share notification email');
        }

        res.status(204).end();
    } catch (err) {
        logError('Error sharing resource:', err);
        res.status(400).json({ error: 'Unable to share resource' });
    }
});

// DELETE /api/shares
router.delete('/shares', async (req, res) => {
    try {
        const { resource_type, resource_uid, target_user_id } = req.body;
        if (!resource_type || !resource_uid || !target_user_id) {
            return res.status(400).json({ error: 'Missing parameters' });
        }
        // Only owner (or admin) can revoke shares
        const userIsAdmin = await isAdmin(req.session.userId);
        const userIsOwner = await isResourceOwner(
            req.session.userId,
            resource_type,
            resource_uid
        );
        if (!userIsAdmin && !userIsOwner) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Prevent revoking permissions from the owner
        const resource = await (async () => {
            if (resource_type === 'project') {
                return await Project.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'task') {
                return await Task.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'note') {
                return await Note.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            }
            return null;
        })();

        if (resource && resource.user_id === Number(target_user_id)) {
            return res.status(400).json({
                error: 'Cannot revoke permissions from the owner.',
            });
        }

        await execAction({
            verb: 'share_revoke',
            actorUserId: req.session.userId,
            targetUserId: Number(target_user_id),
            resourceType: resource_type,
            resourceUid: resource_uid,
        });

        // Send email notification to the target user
        try {
            const resourceDetails = await getResourceDetails(
                resource_type,
                resource_uid
            );
            if (resourceDetails) {
                const targetUser = await User.findByPk(Number(target_user_id), {
                    attributes: ['email', 'id'],
                });
                const ownerUser = await User.findByPk(req.session.userId, {
                    attributes: ['email'],
                });
                if (targetUser && ownerUser) {
                    await sendShareNotificationEmail(
                        targetUser,
                        ownerUser,
                        resource_type,
                        resourceDetails,
                        null,
                        true
                    );
                }
            }
        } catch (emailError) {
            logError(emailError, 'Failed to send share revocation email');
        }

        res.status(204).end();
    } catch (err) {
        logError('Error revoking share:', err);
        res.status(400).json({ error: 'Unable to revoke share' });
    }
});

// GET /api/shares?resource_type=...&resource_uid=...
router.get('/shares', async (req, res) => {
    try {
        const { resource_type, resource_uid } = req.query;
        if (!resource_type || !resource_uid) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Only owner (or admin) can view shares
        const userIsAdmin = await isAdmin(req.session.userId);
        const userIsOwner = await isResourceOwner(
            req.session.userId,
            resource_type,
            resource_uid
        );
        if (!userIsAdmin && !userIsOwner) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get resource owner information
        let ownerInfo = null;
        const resource = await (async () => {
            if (resource_type === 'project') {
                return await Project.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'task') {
                return await Task.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            } else if (resource_type === 'note') {
                return await Note.findOne({
                    where: { uid: resource_uid },
                    attributes: ['user_id'],
                });
            }
            return null;
        })();

        if (resource) {
            const owner = await User.findByPk(resource.user_id, {
                attributes: ['id', 'email'],
            });
            if (owner) {
                ownerInfo = {
                    user_id: owner.id,
                    access_level: 'owner',
                    created_at: null,
                    email: owner.email,
                    is_owner: true,
                };
            }
        }

        const rows = await Permission.findAll({
            where: { resource_type, resource_uid, propagation: 'direct' },
            attributes: ['user_id', 'access_level', 'created_at'],
            raw: true,
        });
        // Attach emails for display
        const userIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(
            Boolean
        );
        let usersById = {};
        if (userIds.length) {
            const users = await User.findAll({
                where: { id: userIds },
                attributes: ['id', 'email'],
                raw: true,
            });
            usersById = users.reduce((acc, u) => {
                acc[u.id] = u.email;
                return acc;
            }, {});
        }
        const withEmails = rows.map((r) => ({
            ...r,
            email: usersById[r.user_id] || null,
            is_owner: false,
        }));

        // Prepend owner to the list
        const allShares = ownerInfo ? [ownerInfo, ...withEmails] : withEmails;

        res.json({ shares: allShares });
    } catch (err) {
        logError('Error listing shares:', err);
        res.status(400).json({ error: 'Unable to list shares' });
    }
});

module.exports = router;
