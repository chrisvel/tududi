'use strict';

const { User, Permission, Project, Task, Note } = require('../../models');

class SharesRepository {
    async findResourceOwner(resourceType, resourceUid) {
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

        return resource;
    }

    async findUserByEmail(email) {
        return User.findOne({ where: { email } });
    }

    async findUserById(id, attributes = ['id', 'email', 'avatar_image']) {
        return User.findByPk(id, { attributes });
    }

    async findUsersByIds(ids) {
        return User.findAll({
            where: { id: ids },
            attributes: ['id', 'email', 'avatar_image'],
            raw: true,
        });
    }

    async findPermissions(resourceType, resourceUid) {
        return Permission.findAll({
            where: { resource_type: resourceType, resource_uid: resourceUid, propagation: 'direct' },
            attributes: ['user_id', 'access_level', 'created_at'],
            raw: true,
        });
    }
}

module.exports = new SharesRepository();
