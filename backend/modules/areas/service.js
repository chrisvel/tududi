'use strict';

const _ = require('lodash');
const areasRepository = require('./repository');
const { PUBLIC_ATTRIBUTES } = require('./repository');
const { validateName, validateUid } = require('./validation');
const { NotFoundError } = require('../../shared/errors');

class AreasService {
    /**
     * Get all areas for a user.
     */
    async getAll(userId) {
        return areasRepository.findAllByUser(userId);
    }

    /**
     * Get a single area by UID.
     */
    async getByUid(userId, uid) {
        validateUid(uid);

        const area = await areasRepository.findByUidPublic(userId, uid);

        if (!area) {
            throw new NotFoundError(
                "Area not found or doesn't belong to the current user."
            );
        }

        return area;
    }

    /**
     * Create a new area.
     */
    async create(userId, { name, description }) {
        const validatedName = validateName(name);

        const area = await areasRepository.createForUser(userId, {
            name: validatedName,
            description,
        });

        return _.pick(area, PUBLIC_ATTRIBUTES);
    }

    /**
     * Update an area.
     */
    async update(userId, uid, { name, description }) {
        validateUid(uid);

        const area = await areasRepository.findByUid(userId, uid);

        if (!area) {
            throw new NotFoundError('Area not found.');
        }

        const updateData = {};

        if (name !== undefined) {
            updateData.name = name;
        }
        if (description !== undefined) {
            updateData.description = description;
        }

        await areasRepository.update(area, updateData);

        return _.pick(area, PUBLIC_ATTRIBUTES);
    }

    /**
     * Delete an area.
     */
    async delete(userId, uid) {
        validateUid(uid);

        const area = await areasRepository.findByUid(userId, uid);

        if (!area) {
            throw new NotFoundError('Area not found.');
        }

        await areasRepository.destroy(area);

        return null; // 204 No Content
    }
}

module.exports = new AreasService();
