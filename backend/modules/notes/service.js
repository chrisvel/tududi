'use strict';

const _ = require('lodash');
const notesRepository = require('./repository');
const { validateUid } = require('./validation');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
} = require('../../shared/errors');
const { Tag, Project } = require('../../models');
const { validateTagName } = require('../tags/tagsService');
const permissionsService = require('../../services/permissionsService');
const { sortTags } = require('../tasks/core/serializers');
const { logError } = require('../../services/logService');

/**
 * Serialize a note with sorted tags.
 */
function serializeNote(note) {
    const noteJson = note.toJSON ? note.toJSON() : note;
    return {
        ...noteJson,
        Tags: sortTags(noteJson.Tags),
    };
}

/**
 * Parse tags from request body (array of strings or objects with name).
 */
function parseTagsFromBody(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }
    if (tags.every((t) => typeof t === 'string')) {
        return tags;
    }
    if (tags.every((t) => typeof t === 'object' && t.name)) {
        return tags.map((t) => t.name);
    }
    return [];
}

/**
 * Update note tags.
 */
async function updateNoteTags(note, tagsArray, userId) {
    if (_.isEmpty(tagsArray)) {
        await note.setTags([]);
        return;
    }

    // Validate and filter tag names
    const validTagNames = [];
    const invalidTags = [];

    for (const name of tagsArray) {
        const validation = validateTagName(name);
        if (validation.valid) {
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name, error: validation.error });
        }
    }

    if (invalidTags.length > 0) {
        throw new ValidationError(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    const tags = await Promise.all(
        validTagNames.map(async (name) => {
            const [tag] = await Tag.findOrCreate({
                where: { name, user_id: userId },
                defaults: { name, user_id: userId },
            });
            return tag;
        })
    );
    await note.setTags(tags);
}

/**
 * Resolve project from UID or ID and check write access.
 */
async function resolveProjectWithAccess(userId, projectUid, projectId) {
    const projectIdentifier = projectUid || projectId;

    if (!projectIdentifier || _.isEmpty(projectIdentifier.toString().trim())) {
        return null;
    }

    let project;
    if (projectUid) {
        const projectUidValue = projectUid.toString().trim();
        project = await Project.findOne({ where: { uid: projectUidValue } });
    } else {
        project = await Project.findByPk(projectId);
    }

    if (!project) {
        throw new NotFoundError('Note project not found');
    }

    const projectAccess = await permissionsService.getAccess(
        userId,
        'project',
        project.uid
    );
    const isOwner = project.user_id === userId;
    const canWrite =
        isOwner || projectAccess === 'rw' || projectAccess === 'admin';

    if (!canWrite) {
        throw new ForbiddenError('Forbidden');
    }

    return project;
}

class NotesService {
    /**
     * Get all notes for a user with optional filtering.
     */
    async getAll(userId, options = {}) {
        const { orderBy = 'title:asc', tagFilter } = options;
        const [orderColumn, orderDirection] = orderBy.split(':');

        const whereClause = await permissionsService.ownershipOrPermissionWhere(
            'note',
            userId
        );

        const notes = await notesRepository.findAllWithIncludes(whereClause, {
            orderColumn,
            orderDirection: orderDirection.toUpperCase(),
            tagFilter,
        });

        return notes.map(serializeNote);
    }

    /**
     * Get a note by UID.
     */
    async getByUid(uid) {
        const validatedUid = validateUid(uid);
        const note = await notesRepository.findByUidWithIncludes(validatedUid);

        if (!note) {
            throw new NotFoundError('Note not found.');
        }

        return serializeNote(note);
    }

    /**
     * Check if a note exists and return its UID (for authorization middleware).
     */
    async getNoteUidIfExists(uid) {
        const validatedUid = validateUid(uid);
        const note = await notesRepository.findByUid(validatedUid);
        return note ? note.uid : null;
    }

    /**
     * Create a new note.
     */
    async create(
        userId,
        { title, content, project_uid, project_id, tags, color }
    ) {
        const noteAttributes = { title, content };

        if (color !== undefined) {
            noteAttributes.color = color;
        }

        // Handle project assignment with permission check
        const project = await resolveProjectWithAccess(
            userId,
            project_uid,
            project_id
        );
        if (project) {
            noteAttributes.project_id = project.id;
        }

        const note = await notesRepository.createForUser(
            userId,
            noteAttributes
        );

        // Handle tags
        const tagNames = parseTagsFromBody(tags);
        await updateNoteTags(note, tagNames, userId);

        // Reload with associations
        const noteWithAssociations = await notesRepository.findByIdWithIncludes(
            note.id
        );
        const serialized = serializeNote(noteWithAssociations);

        return {
            ...serialized,
            uid: noteWithAssociations.uid,
        };
    }

    /**
     * Update a note.
     */
    async update(
        userId,
        uid,
        { title, content, project_uid, project_id, tags, color }
    ) {
        const validatedUid = validateUid(uid);
        const note = await notesRepository.findOne({ uid: validatedUid });

        if (!note) {
            throw new NotFoundError('Note not found.');
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (color !== undefined) updateData.color = color;

        // Handle project assignment
        const projectIdentifier =
            project_uid !== undefined ? project_uid : project_id;

        if (projectIdentifier !== undefined) {
            if (projectIdentifier && projectIdentifier.toString().trim()) {
                let project;

                if (
                    project_uid !== undefined &&
                    typeof project_uid === 'string'
                ) {
                    const projectUidValue = project_uid.trim();
                    project = await Project.findOne({
                        where: { uid: projectUidValue },
                    });
                } else if (project_id !== undefined) {
                    project = await Project.findByPk(project_id);
                }

                if (!project) {
                    throw new ValidationError('Invalid project.');
                }

                const projectAccess = await permissionsService.getAccess(
                    userId,
                    'project',
                    project.uid
                );
                const isOwner = project.user_id === userId;
                const canWrite =
                    isOwner ||
                    projectAccess === 'rw' ||
                    projectAccess === 'admin';

                if (!canWrite) {
                    throw new ForbiddenError('Forbidden');
                }

                updateData.project_id = project.id;
            } else {
                updateData.project_id = null;
            }
        }

        await notesRepository.update(note, updateData);

        // Handle tags if provided
        if (tags !== undefined) {
            const tagNames = parseTagsFromBody(tags);
            await updateNoteTags(note, tagNames, userId);
        }

        // Reload with associations
        const noteWithAssociations =
            await notesRepository.findByIdWithDetailedIncludes(note.id);
        return serializeNote(noteWithAssociations);
    }

    /**
     * Delete a note.
     */
    async delete(uid) {
        const validatedUid = validateUid(uid);
        const note = await notesRepository.findOne({ uid: validatedUid });

        if (!note) {
            throw new NotFoundError('Note not found.');
        }

        await notesRepository.destroy(note);
        return { message: 'Note deleted successfully.' };
    }
}

module.exports = new NotesService();
module.exports.serializeNote = serializeNote;
