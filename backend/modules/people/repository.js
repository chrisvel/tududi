'use strict';

const { Person, Task } = require('../../models');
const { Op } = require('sequelize');

class PeopleRepository {
    async findAllByUser(
        userId,
        { archived = false, sort = 'name', relationship_type } = {}
    ) {
        const where = { user_id: userId };
        if (archived !== null) {
            where.archived = archived === true || archived === 'true';
        }
        if (relationship_type) {
            where.relationship_type = relationship_type;
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
}

module.exports = new PeopleRepository();
