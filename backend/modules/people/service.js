'use strict';

const peopleRepository = require('./repository');
const {
    NotFoundError,
    ValidationError,
    ConflictError,
} = require('../../shared/errors');

const VALID_RELATIONSHIP_TYPES = ['family', 'work', 'friend', 'other'];

class PeopleService {
    async getAll(userId, filters = {}) {
        return peopleRepository.findAllByUser(userId, filters);
    }

    async getByUid(userId, uid) {
        const person = await peopleRepository.findByUid(userId, uid);
        if (!person) throw new NotFoundError('Person not found');
        return person;
    }

    async create(userId, data) {
        const { name, relationship_type, email, phone, notes, color } = data;

        if (!name || !name.trim()) {
            throw new ValidationError('Name is required');
        }

        if (
            relationship_type &&
            !VALID_RELATIONSHIP_TYPES.includes(relationship_type)
        ) {
            throw new ValidationError(
                `relationship_type must be one of: ${VALID_RELATIONSHIP_TYPES.join(', ')}`
            );
        }

        const exists = await peopleRepository.nameExists(userId, name.trim());
        if (exists) {
            throw new ConflictError(
                `Person named '${name.trim()}' already exists`
            );
        }

        return peopleRepository.create({
            user_id: userId,
            name: name.trim(),
            relationship_type: relationship_type || 'other',
            email: email || null,
            phone: phone || null,
            notes: notes || null,
            color: color || null,
            archived: false,
        });
    }

    async update(userId, uid, data) {
        const person = await peopleRepository.findByUid(userId, uid);
        if (!person) throw new NotFoundError('Person not found');

        const {
            name,
            relationship_type,
            email,
            phone,
            notes,
            color,
            archived,
        } = data;
        const updates = {};

        if (name !== undefined) {
            if (!name.trim()) throw new ValidationError('Name cannot be empty');
            const exists = await peopleRepository.nameExists(
                userId,
                name.trim(),
                uid
            );
            if (exists)
                throw new ConflictError(
                    `Person named '${name.trim()}' already exists`
                );
            updates.name = name.trim();
        }

        if (relationship_type !== undefined) {
            if (
                relationship_type &&
                !VALID_RELATIONSHIP_TYPES.includes(relationship_type)
            ) {
                throw new ValidationError(
                    `relationship_type must be one of: ${VALID_RELATIONSHIP_TYPES.join(', ')}`
                );
            }
            updates.relationship_type = relationship_type || 'other';
        }

        if (email !== undefined) updates.email = email || null;
        if (phone !== undefined) updates.phone = phone || null;
        if (notes !== undefined) updates.notes = notes || null;
        if (color !== undefined) updates.color = color || null;
        if (archived !== undefined) updates.archived = !!archived;

        return peopleRepository.update(person, updates);
    }

    async delete(userId, uid) {
        const person = await peopleRepository.findByUid(userId, uid);
        if (!person) throw new NotFoundError('Person not found');

        const assignedCount = await peopleRepository.countAssignedTasks(uid);
        if (assignedCount > 0) {
            throw new ValidationError(
                `Cannot delete: ${assignedCount} task${assignedCount === 1 ? '' : 's'} assigned to this person. Archive or unassign first.`
            );
        }

        await peopleRepository.delete(person);
    }

    async archive(userId, uid) {
        return this.update(userId, uid, { archived: true });
    }

    async unarchive(userId, uid) {
        return this.update(userId, uid, { archived: false });
    }
}

module.exports = new PeopleService();
