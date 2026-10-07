'use strict';

const { Person, Task, Project, User, OIDCIdentity } = require('../../models');
const permissionSources = require('../../services/permissionSources');
const { Op } = require('sequelize');

class PeopleRepository {
    async findAllByUser(
        userId,
        { archived = false, sort = 'name', relationship_type, unlinked } = {}
    ) {
        const where = { user_id: userId };
        if (archived !== null) {
            where.archived = archived === true || archived === 'true';
        }
        if (relationship_type) {
            where.relationship_type = relationship_type;
        }
        if (unlinked === true || unlinked === 'true') {
            where.linked_user_id = null;
        }

        const order =
            sort === 'created_at'
                ? [['created_at', 'DESC']]
                : [['name', 'ASC']];

        return Person.findAll({ where, order });
    }

    async findByUid(userId, uid) {
        return Person.findOne({ where: { uid, user_id: userId } });
    }

    // A person whoever owns it, for the callers that decide for themselves
    // whether it may be shown.
    async findAnyByUid(uid) {
        return Person.findOne({ where: { uid } });
    }

    // What decides whether an account can sign in yet.
    async findAccountSignInFacts(userIds) {
        if (!userIds.length) return { users: [], identityUserIds: new Set() };
        const [users, identities] = await Promise.all([
            User.findAll({
                where: { id: userIds },
                attributes: [
                    'id',
                    'email',
                    'password_digest',
                    'email_verified',
                ],
                raw: true,
            }),
            OIDCIdentity.findAll({
                where: { user_id: userIds },
                attributes: ['user_id'],
                raw: true,
            }),
        ]);
        return {
            users,
            identityUserIds: new Set(identities.map((i) => i.user_id)),
        };
    }

    async nameExists(userId, name, excludeUid = null) {
        const where = { user_id: userId, name };
        if (excludeUid) {
            where.uid = { [Op.ne]: excludeUid };
        }
        const count = await Person.count({ where });
        return count > 0;
    }

    async create(data) {
        return Person.create(data);
    }

    async update(person, data) {
        return person.update(data);
    }

    async delete(person) {
        return person.destroy();
    }

    async countAssignedTasks(personUid) {
        return Task.count({ where: { assigned_to: personUid } });
    }

    async findByLinkedUserId(ownerUserId, linkedUserId) {
        return Person.findOne({
            where: { user_id: ownerUserId, linked_user_id: linkedUserId },
        });
    }

    async findProjectOwnerUserId(projectUid) {
        const project = await Project.findOne({
            where: { uid: projectUid },
            attributes: ['user_id'],
            raw: true,
        });
        return project ? project.user_id : null;
    }

    async findProjectCollaboratorUserIds(projectUid) {
        const rows = await permissionSources.findAccepted(
            { resource_type: 'project', resource_uid: projectUid },
            ['user_id']
        );
        return Array.from(new Set(rows.map((r) => r.user_id)));
    }

    // Only each user's canonical self-person. Other users' contact cards that
    // happen to link the same account are private to their owners.
    async findSelfPeopleByUserIds(userIds) {
        if (!userIds.length) return [];
        const people = await Person.findAll({
            where: { linked_user_id: userIds },
            order: [['name', 'ASC']],
        });
        return people.filter((p) => p.user_id === p.linked_user_id);
    }
}

module.exports = new PeopleRepository();
