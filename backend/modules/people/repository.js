'use strict';

const { Person, Task } = require('../../models');
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
}

module.exports = new PeopleRepository();
