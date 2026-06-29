'use strict';

const tagsRepository = require('./repository');
const { validateTagName } = require('./validation');
const {
    NotFoundError,
    ConflictError,
    ForbiddenError,
} = require('../../shared/errors');

class TagsService {
    /**
     * Get all tags for a user.
     */
    async getAllForUser(userId) {
        const tags = await tagsRepository.findAllByUser(userId);
        return tags.map((tag) => ({
            uid: tag.uid,
            name: tag.name,
            tag_type: tag.tag_type,
            pinned: tag.pinned,
            color: tag.color || null,
            usage_count: Number(tag.get('usage_count') ?? 0),
            tasks_count: Number(tag.get('tasks_count') ?? 0),
            notes_count: Number(tag.get('notes_count') ?? 0),
            projects_count: Number(tag.get('projects_count') ?? 0),
        }));
    }

    /**
     * Get a single tag by uid or name.
     */
    async getByQuery(userId, { uid, name }) {
        let tag = null;

        if (uid) {
            tag = await tagsRepository.findByUid(userId, uid);
        } else if (name) {
            tag = await tagsRepository.findByName(
                userId,
                decodeURIComponent(name)
            );
        }

        if (!tag) {
            throw new NotFoundError('Tag not found');
        }

        return {
            uid: tag.uid,
            name: tag.name,
            tag_type: tag.tag_type,
            pinned: tag.pinned,
            color: tag.color || null,
        };
    }

    /**
     * Create a new tag.
     */
    async create(userId, name) {
        const validatedName = validateTagName(name);

        const exists = await tagsRepository.nameExists(userId, validatedName);
        if (exists) {
            throw new ConflictError(
                `A tag with the name "${validatedName}" already exists.`
            );
        }

        const tag = await tagsRepository.createForUser(userId, validatedName);

        return {
            uid: tag.uid,
            name: tag.name,
        };
    }

    /**
     * Update a tag's name and/or pinned state.
     */
    async update(userId, identifier, { name, pinned, color } = {}) {
        const decodedIdentifier = decodeURIComponent(identifier);
        const tag = await tagsRepository.findByIdentifier(
            userId,
            decodedIdentifier
        );

        if (!tag) {
            throw new NotFoundError('Tag not found');
        }

        const updates = {};

        if (name !== undefined) {
            if (tag.tag_type === 'system') {
                // Silently ignore name field for system tags - the form always sends it
            } else {
                const validatedName = validateTagName(name);
                if (validatedName !== tag.name) {
                    const exists = await tagsRepository.nameExists(
                        userId,
                        validatedName,
                        tag.id
                    );
                    if (exists) {
                        throw new ConflictError(
                            `A tag with the name "${validatedName}" already exists.`
                        );
                    }
                    updates.name = validatedName;
                }
            }
        }

        if (pinned !== undefined) {
            updates.pinned = Boolean(pinned);
        }

        if (color !== undefined) {
            updates.color = color === '' ? null : color;
        }

        if (Object.keys(updates).length > 0) {
            await tagsRepository.update(tag, updates);
        }

        return {
            id: tag.id,
            uid: tag.uid,
            name: updates.name ?? tag.name,
            pinned: updates.pinned !== undefined ? updates.pinned : tag.pinned,
            color: updates.color !== undefined ? updates.color : tag.color,
        };
    }

    /**
     * Delete a tag and all its associations.
     */
    async delete(userId, identifier) {
        const decodedIdentifier = decodeURIComponent(identifier);
        const tag = await tagsRepository.findByIdentifier(
            userId,
            decodedIdentifier
        );

        if (!tag) {
            throw new NotFoundError('Tag not found');
        }

        if (tag.tag_type === 'system') {
            throw new ForbiddenError('System tags cannot be deleted');
        }

        await tagsRepository.deleteWithAssociations(tag);

        return { message: 'Tag successfully deleted' };
    }
}

// Export singleton instance
module.exports = new TagsService();
