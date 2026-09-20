'use strict';

const peopleRepository = require('./repository');
const { isAdmin } = require('../../services/rolesService');
const { getWorkspaceUserIds } = require('../../services/workspaceMembers');
const { selfPersonName } = require('../../utils/selfPersonName');
const {
    NotFoundError,
    ValidationError,
    ConflictError,
    ForbiddenError,
} = require('../../shared/errors');

const VALID_RELATIONSHIP_TYPES = ['family', 'work', 'friend', 'other'];

class PeopleService {
    // Flag the caller's own canonical self-person so the UI can offer a
    // "(me)" option for quick self-assignment.
    markSelf(userId, people) {
        return people.map((p) => {
            const plain =
                typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
            plain.is_self =
                plain.user_id === userId && plain.linked_user_id === userId;
            return plain;
        });
    }

    async getAll(userId, filters = {}) {
        const people = await peopleRepository.findAllByUser(userId, filters);
        return this.markSelf(userId, people);
    }

    // A collaborator's self-person is theirs to edit, so other people only get
    // what an assignee picker needs, never the phone, notes or email.
    toAssignee(userId, person) {
        const plain = this.markSelf(userId, [person])[0];
        if (plain.user_id === userId) return plain;
        delete plain.phone;
        delete plain.notes;
        delete plain.email;
        return plain;
    }

    // The viewer's own cards plus the given members' self-persons. A card of
    // the viewer's that stands in for a member with a self-person is dropped,
    // so one human is never offered twice.
    mergeAssignable(userId, ownPeople, memberSelfPeople) {
        const memberUserIds = new Set(
            memberSelfPeople.map((p) => p.linked_user_id)
        );
        const ownUids = new Set(ownPeople.map((p) => p.uid));

        const kept = ownPeople.filter(
            (p) =>
                p.user_id === p.linked_user_id ||
                !p.linked_user_id ||
                !memberUserIds.has(p.linked_user_id)
        );
        const added = memberSelfPeople.filter((p) => !ownUids.has(p.uid));

        return [...kept, ...added].map((p) => this.toAssignee(userId, p));
    }

    async getAssignableForUsers(userId, memberUserIds, filters) {
        const ownPeople = await peopleRepository.findAllByUser(userId, filters);
        const otherUserIds = Array.from(new Set(memberUserIds)).filter(
            (id) => id !== userId
        );
        const memberSelfPeople =
            await peopleRepository.findSelfPeopleByUserIds(otherUserIds);
        return this.mergeAssignable(userId, ownPeople, memberSelfPeople);
    }

    // Everyone the caller works with, for tasks that are not in a project:
    // their own people plus the self-person of every account they share with
    // or are in a group with.
    async getAssignable(userId, filters = {}) {
        const memberUserIds = await getWorkspaceUserIds(userId);
        return this.getAssignableForUsers(userId, memberUserIds, filters);
    }

    // Own people plus the self-person of the project owner and any
    // collaborators the project is shared with, so a task in a shared
    // project can be assigned to anyone who actually has access to it.
    async getAssignableForProject(userId, projectUid, filters = {}) {
        const ownerUserId =
            await peopleRepository.findProjectOwnerUserId(projectUid);
        const collaboratorUserIds = ownerUserId
            ? await peopleRepository.findProjectCollaboratorUserIds(projectUid)
            : [];

        return this.getAssignableForUsers(
            userId,
            ownerUserId ? [ownerUserId, ...collaboratorUserIds] : [],
            filters
        );
    }

    // Linking a card to an account makes that account count as the person, so
    // it must be someone the caller works with (admins may link anyone).
    async assertCanLink(userId, linkedUserId) {
        if (linkedUserId === userId) return;
        if (await isAdmin(userId)) return;
        const workspaceUserIds = await getWorkspaceUserIds(userId);
        if (!workspaceUserIds.includes(linkedUserId)) {
            throw new ForbiddenError(
                'You can only link a person to someone you share with'
            );
        }
    }

    async getUnlinked(userId) {
        return peopleRepository.findAllByUser(userId, {
            archived: false,
            unlinked: true,
        });
    }

    async getByUid(userId, uid) {
        const person = await peopleRepository.findByUid(userId, uid);
        if (!person) throw new NotFoundError('Person not found');
        return person;
    }

    async create(userId, data) {
        const {
            name,
            relationship_type,
            email,
            phone,
            notes,
            color,
            linked_user_id,
        } = data;

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

        let validatedLinkedUserId = null;
        if (linked_user_id != null) {
            if (!Number.isInteger(linked_user_id)) {
                throw new ValidationError(
                    'linked_user_id must be a valid user ID'
                );
            }
            const existingLink = await peopleRepository.findByLinkedUserId(
                userId,
                linked_user_id
            );
            if (existingLink) {
                throw new ConflictError(
                    'A person already linked to that user account exists'
                );
            }
            await this.assertCanLink(userId, linked_user_id);
            validatedLinkedUserId = linked_user_id;
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
            linked_user_id: validatedLinkedUserId,
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
            linked_user_id,
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

        if (linked_user_id !== undefined) {
            if (linked_user_id === null) {
                updates.linked_user_id = null;
            } else {
                if (!Number.isInteger(linked_user_id)) {
                    throw new ValidationError(
                        'linked_user_id must be a valid user ID'
                    );
                }
                const existingLink = await peopleRepository.findByLinkedUserId(
                    userId,
                    linked_user_id
                );
                if (existingLink && existingLink.uid !== uid) {
                    throw new ConflictError(
                        'A person already linked to that user account exists'
                    );
                }
                if (person.linked_user_id !== linked_user_id) {
                    await this.assertCanLink(userId, linked_user_id);
                }
                updates.linked_user_id = linked_user_id;
            }
        }

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

    async createSelfPerson(user) {
        const existing = await peopleRepository.findByLinkedUserId(
            user.id,
            user.id
        );
        if (existing) return existing;

        let name = selfPersonName(user);

        const nameConflict = await peopleRepository.nameExists(user.id, name);
        if (nameConflict) name = `${name} (me)`;

        return peopleRepository.create({
            user_id: user.id,
            linked_user_id: user.id,
            name,
            email: user.email || null,
            relationship_type: 'other',
            archived: false,
        });
    }
}

module.exports = new PeopleService();
