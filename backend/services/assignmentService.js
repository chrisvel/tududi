'use strict';

const { Op } = require('sequelize');
const {
    Person,
    Permission,
    Project,
    Area,
    User,
    Notification,
} = require('../models');
const permissionsService = require('./permissionsService');
const { logError } = require('./logService');

/**
 * Everyone who can see a project: its owner plus users holding permission
 * rows on the project (and, when the deployment supports area sharing, on
 * the project's area — on installations without area shares those rows
 * simply never exist).
 */
async function getProjectParticipants(requesterUserId, projectUid) {
    const project = await Project.findOne({
        where: { uid: projectUid },
        attributes: ['id', 'uid', 'user_id', 'area_id'],
        raw: true,
    });
    if (!project) {
        const err = new Error('Project not found');
        err.status = 404;
        throw err;
    }

    const access = await permissionsService.getAccess(
        requesterUserId,
        'project',
        project.uid
    );
    if (access === permissionsService.ACCESS.NONE) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
    }

    const resourceConditions = [
        { resource_type: 'project', resource_uid: project.uid },
    ];
    if (project.area_id) {
        const area = await Area.findOne({
            where: { id: project.area_id },
            attributes: ['uid'],
            raw: true,
        });
        if (area) {
            resourceConditions.push({
                resource_type: 'area',
                resource_uid: area.uid,
            });
        }
    }

    const rows = await Permission.findAll({
        where: { [Op.or]: resourceConditions },
        attributes: ['user_id'],
        raw: true,
    });

    const userIds = [
        ...new Set([project.user_id, ...rows.map((r) => r.user_id)]),
    ];

    const [users, selfPersons] = await Promise.all([
        User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ['id', 'email', 'name', 'surname', 'avatar_image'],
            raw: true,
        }),
        Person.findAll({
            where: { linked_user_id: { [Op.in]: userIds } },
            attributes: ['uid', 'user_id', 'linked_user_id'],
            raw: true,
        }),
    ]);

    // A self-person is the person record a user holds for themselves
    const selfPersonByUserId = {};
    selfPersons.forEach((p) => {
        if (p.user_id === p.linked_user_id) {
            selfPersonByUserId[p.linked_user_id] = p.uid;
        }
    });

    return users
        .map((u) => ({
            user_id: u.id,
            email: u.email,
            name:
                [u.name, u.surname].filter(Boolean).join(' ').trim() || u.email,
            avatar_image: u.avatar_image,
            person_uid: selfPersonByUserId[u.id] || null,
            is_owner: u.id === project.user_id,
        }))
        .sort((a, b) => Number(b.is_owner) - Number(a.is_owner));
}

/**
 * A task may be assigned to:
 *  - a person in the actor's or the task owner's own people book (the
 *    single-user behaviour, unchanged), or
 *  - the self-person of any user who can access the task's project
 *    (cross-account assignment on shared projects).
 * Throws with .status on violation.
 */
async function validateAssignedTo(
    actorUserId,
    taskOwnerUserId,
    projectId,
    assignedTo
) {
    if (!assignedTo) return null;

    const person = await Person.findOne({
        where: { uid: assignedTo },
        attributes: ['uid', 'user_id', 'linked_user_id'],
        raw: true,
    });
    if (!person) {
        const err = new Error('Invalid assigned person.');
        err.status = 400;
        throw err;
    }

    if (person.user_id === actorUserId || person.user_id === taskOwnerUserId) {
        return person;
    }

    // Cross-account: only self-persons of project participants
    const isSelfPerson =
        person.linked_user_id && person.user_id === person.linked_user_id;
    if (isSelfPerson && projectId) {
        const project = await Project.findOne({
            where: { id: projectId },
            attributes: ['uid'],
            raw: true,
        });
        if (project) {
            const access = await permissionsService.getAccess(
                person.linked_user_id,
                'project',
                project.uid
            );
            if (access !== permissionsService.ACCESS.NONE) {
                return person;
            }
        }
    }

    const err = new Error(
        'Assigned person must be yours or a member of the shared project.'
    );
    err.status = 403;
    throw err;
}

/**
 * Notify the linked user when a task gets assigned to them. Fire-and-forget:
 * a notification failure must never fail the task write.
 */
async function notifyAssignmentChange({ actorUser, task, previousAssignedTo }) {
    try {
        const assignedTo = task.assigned_to;
        if (!assignedTo || assignedTo === previousAssignedTo) return;

        const person = await Person.findOne({
            where: { uid: assignedTo },
            attributes: ['linked_user_id'],
            raw: true,
        });
        if (!person?.linked_user_id) return;
        if (person.linked_user_id === actorUser.id) return;

        const actorName =
            [actorUser.name, actorUser.surname].filter(Boolean).join(' ') ||
            actorUser.email;

        await Notification.createNotification({
            userId: person.linked_user_id,
            type: 'task_assigned',
            title: 'Task assigned to you',
            message: `${actorName} assigned you "${task.name}"`,
            level: 'info',
            sources: [],
            data: {
                taskUid: task.uid,
                taskName: task.name,
                assignedByUserId: actorUser.id,
            },
            sentAt: new Date(),
        });
    } catch (error) {
        logError('Error creating assignment notification:', error);
    }
}

/**
 * Person uids that represent the given user (for assigned-to-me queries).
 */
async function getLinkedPersonUids(userId) {
    const people = await Person.findAll({
        where: { linked_user_id: userId },
        attributes: ['uid'],
        raw: true,
    });
    return people.map((p) => p.uid);
}

module.exports = {
    getProjectParticipants,
    validateAssignedTo,
    notifyAssignmentChange,
    getLinkedPersonUids,
};
