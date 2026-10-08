'use strict';

const _ = require('lodash');
const areasRepository = require('./repository');
const { PUBLIC_ATTRIBUTES, LIST_ATTRIBUTES } = require('./repository');
const { validateName, validateUid } = require('./validation');
const { NotFoundError, ForbiddenError } = require('../../shared/errors');
const permissionsService = require('../../services/permissionsService');
const { ACCESS } = permissionsService;

// An area the caller can neither own nor was shared reads as missing, so
// area uids cannot be probed.
async function accessTo(userId, uid) {
    return permissionsService.getAccess(userId, 'area', uid);
}

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

        const area = await areasRepository.findAnyByUid(uid, PUBLIC_ATTRIBUTES);

        if (!area || (await accessTo(userId, uid)) === ACCESS.NONE) {
            throw new NotFoundError(
                "Area not found or doesn't belong to the current user."
            );
        }

        return area;
    }

    /**
     * Create a new area.
     */
    async create(userId, { name, description, color }) {
        const validatedName = validateName(name);

        const area = await areasRepository.createForUser(userId, {
            name: validatedName,
            description,
            color: color || null,
        });

        // The frontend adds this straight to its areas list, and pickers
        // select areas by id.
        return _.pick(area, LIST_ATTRIBUTES);
    }

    /**
     * Update an area.
     */
    async update(userId, uid, { name, description, color }) {
        validateUid(uid);

        const area = await areasRepository.findAnyByUid(uid);
        const access = area ? await accessTo(userId, uid) : ACCESS.NONE;

        if (access === ACCESS.NONE) {
            throw new NotFoundError('Area not found.');
        }
        if (access !== ACCESS.RW && access !== ACCESS.ADMIN) {
            throw new ForbiddenError('Forbidden');
        }

        const updateData = {};

        if (name !== undefined) {
            updateData.name = name;
        }
        if (description !== undefined) {
            updateData.description = description;
        }
        if (color !== undefined) {
            updateData.color = color === '' ? null : color;
        }

        await areasRepository.update(area, updateData);

        return _.pick(area, LIST_ATTRIBUTES);
    }

    /**
     * Delete an area.
     */
    async delete(userId, uid) {
        validateUid(uid);

        const area = await areasRepository.findAnyByUid(uid);
        const access = area ? await accessTo(userId, uid) : ACCESS.NONE;

        if (access === ACCESS.NONE) {
            throw new NotFoundError('Area not found.');
        }
        // Deleting an area orphans the owner's projects and goals, so only
        // the owner can do it, not someone it was shared with.
        if (area.user_id !== userId) {
            throw new ForbiddenError('Only the owner can delete this area.');
        }

        await areasRepository.destroy(area);

        return null; // 204 No Content
    }
}

module.exports = new AreasService();
