'use strict';

const { Op } = require('sequelize');
const projectsRepository = require('./repository');
const { validateUid, validateName, formatDate } = require('./validation');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { validateTagName } = require('../tags/tagsService');
const permissionsService = require('../../services/permissionsService');
const { sortTags } = require('../tasks/core/serializers');
const { uid: generateUid } = require('../../utils/uid');
const { extractUidFromSlug } = require('../../utils/slug-utils');
const { logError } = require('../../services/logService');

/**
 * Update project tags.
 */
async function updateProjectTags(project, tagsData, userId) {
    if (!tagsData) return;

    const validTagNames = [];
    const invalidTags = [];

    for (const tag of tagsData) {
        const validation = validateTagName(tag.name);
        if (validation.valid) {
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name: tag.name, error: validation.error });
        }
    }

    if (invalidTags.length > 0) {
        throw new ValidationError(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    if (validTagNames.length === 0) {
        await project.setTags([]);
        return;
    }

    const existingTags = await projectsRepository.findTagsByNames(
        userId,
        validTagNames
    );
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = validTagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => projectsRepository.createTag(name, userId))
    );

    await project.setTags([...existingTags, ...createdTags]);
}

/**
 * Calculate task status counts.
 */
function calculateTaskStatus(tasks) {
    const taskList = tasks || [];
    return {
        total: taskList.length,
        done: taskList.filter((t) => t.status === 2).length,
        in_progress: taskList.filter((t) => t.status === 1).length,
        not_started: taskList.filter((t) => t.status === 0).length,
    };
}

class ProjectsService {
    /**
     * Get all projects for a user with filters.
     */
    async getAll(userId, query) {
        const {
            status,
            state,
            active,
            pin_to_sidebar,
            area_id,
            area,
            grouped,
        } = query;
        const statusFilter = status || state;

        let whereClause = await permissionsService.ownershipOrPermissionWhere(
            'project',
            userId
        );

        if (statusFilter && statusFilter !== 'all') {
            if (Array.isArray(statusFilter)) {
                whereClause.status = { [Op.in]: statusFilter };
            } else {
                whereClause.status = statusFilter;
            }
        }

        if (active === 'true') {
            whereClause.status = {
                [Op.in]: ['planned', 'in_progress', 'waiting'],
            };
        } else if (active === 'false') {
            whereClause.status = { [Op.in]: ['not_started', 'done'] };
        }

        if (pin_to_sidebar === 'true') {
            whereClause.pin_to_sidebar = true;
        } else if (pin_to_sidebar === 'false') {
            whereClause.pin_to_sidebar = false;
        }

        if (area && area !== '') {
            const uid = extractUidFromSlug(area);
            if (uid) {
                const areaRecord = await projectsRepository.findAreaByUid(uid);
                if (areaRecord) {
                    whereClause = {
                        [Op.and]: [whereClause, { area_id: areaRecord.id }],
                    };
                }
            }
        } else if (area_id && area_id !== '') {
            whereClause = { [Op.and]: [whereClause, { area_id }] };
        }

        const projects =
            await projectsRepository.findAllWithFilters(whereClause);

        const projectUids = projects.map((p) => p.uid).filter(Boolean);
        const shareCountMap =
            await projectsRepository.getShareCounts(projectUids);

        const enhancedProjects = projects.map((project) => {
            const taskStatus = calculateTaskStatus(project.Tasks);
            const projectJson = project.toJSON();
            const shareCount = shareCountMap[project.uid] || 0;

            return {
                ...projectJson,
                tags: sortTags(projectJson.Tags),
                due_date_at: formatDate(project.due_date_at),
                task_status: taskStatus,
                completion_percentage:
                    taskStatus.total > 0
                        ? Math.round((taskStatus.done / taskStatus.total) * 100)
                        : 0,
                user_uid: projectJson.User?.uid,
                share_count: shareCount,
                is_shared: shareCount > 0,
            };
        });

        if (grouped === 'true') {
            const groupedProjects = {};
            enhancedProjects.forEach((project) => {
                const areaName = project.Area ? project.Area.name : 'No Area';
                if (!groupedProjects[areaName]) {
                    groupedProjects[areaName] = [];
                }
                groupedProjects[areaName].push(project);
            });
            return groupedProjects;
        }

        return { projects: enhancedProjects };
    }

    /**
     * Get project by UID.
     */
    async getByUid(uid) {
        const validatedUid = validateUid(uid);
        const project =
            await projectsRepository.findByUidWithIncludes(validatedUid);

        if (!project) {
            throw new NotFoundError('Project not found');
        }

        const projectJson = project.toJSON();

        const normalizedTasks = projectJson.Tasks
            ? projectJson.Tasks.map((task) => {
                  const normalizedTask = {
                      ...task,
                      tags: sortTags(task.Tags),
                      subtasks: (task.Subtasks || []).map((subtask) => ({
                          ...subtask,
                          tags: sortTags(subtask.Tags),
                      })),
                      due_date: task.due_date
                          ? typeof task.due_date === 'string'
                              ? task.due_date.split('T')[0]
                              : task.due_date.toISOString().split('T')[0]
                          : null,
                  };
                  delete normalizedTask.Tags;
                  delete normalizedTask.Subtasks;
                  return normalizedTask;
              })
            : [];

        const normalizedNotes = projectJson.Notes
            ? projectJson.Notes.map((note) => {
                  const normalizedNote = { ...note, tags: sortTags(note.Tags) };
                  delete normalizedNote.Tags;
                  return normalizedNote;
              })
            : [];

        const shareCount = project.uid
            ? await projectsRepository.getShareCount(project.uid)
            : 0;

        return {
            ...projectJson,
            tags: sortTags(projectJson.Tags),
            Tasks: normalizedTasks,
            Notes: normalizedNotes,
            due_date_at: formatDate(project.due_date_at),
            user_id: project.user_id,
            share_count: shareCount,
            is_shared: shareCount > 0,
        };
    }

    /**
     * Check if project exists and return UID (for authorization).
     */
    async getProjectUidIfExists(uidOrSlug) {
        const uid = extractUidFromSlug(uidOrSlug);
        const project = await projectsRepository.findByUid(uid);
        return project ? project.uid : null;
    }

    /**
     * Create a new project.
     */
    async create(userId, data) {
        const {
            name,
            description,
            area_id,
            priority,
            due_date_at,
            image_url,
            status,
            state,
            tags,
            Tags,
        } = data;

        const validatedName = validateName(name);
        const tagsData = tags || Tags;
        const projectUid = generateUid();

        const projectData = {
            uid: projectUid,
            name: validatedName,
            description: description || '',
            area_id: area_id || null,
            pin_to_sidebar: false,
            priority: priority || null,
            due_date_at: due_date_at || null,
            image_url: image_url || null,
            status: status || state || 'not_started',
            user_id: userId,
        };

        const project = await projectsRepository.create(projectData);

        try {
            await updateProjectTags(project, tagsData, userId);
        } catch (tagError) {
            logError(
                'Tag update failed, but project created successfully:',
                tagError.message
            );
        }

        return {
            ...project.toJSON(),
            uid: projectUid,
            tags: [],
            due_date_at: formatDate(project.due_date_at),
        };
    }

    /**
     * Update a project.
     */
    async update(userId, uid, data) {
        const validatedUid = validateUid(uid);
        const project = await projectsRepository.findOne({ uid: validatedUid });

        if (!project) {
            throw new NotFoundError('Project not found.');
        }

        const {
            name,
            description,
            area_id,
            pin_to_sidebar,
            priority,
            due_date_at,
            image_url,
            status,
            state,
            tags,
            Tags,
        } = data;

        const tagsData = tags || Tags;
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (area_id !== undefined) updateData.area_id = area_id;
        if (pin_to_sidebar !== undefined)
            updateData.pin_to_sidebar = pin_to_sidebar;
        if (priority !== undefined) updateData.priority = priority;
        if (due_date_at !== undefined) updateData.due_date_at = due_date_at;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (status !== undefined) updateData.status = status;
        else if (state !== undefined) updateData.status = state;

        await projectsRepository.update(project, updateData);
        await updateProjectTags(project, tagsData, userId);

        const projectWithAssociations =
            await projectsRepository.findByUidWithTagsAndArea(validatedUid);
        const projectJson = projectWithAssociations.toJSON();

        return {
            ...projectJson,
            tags: sortTags(projectJson.Tags),
            due_date_at: formatDate(projectWithAssociations.due_date_at),
        };
    }

    /**
     * Delete a project.
     */
    async delete(userId, uid) {
        const validatedUid = validateUid(uid);
        const project = await projectsRepository.findOne({ uid: validatedUid });

        if (!project) {
            throw new NotFoundError('Project not found.');
        }

        await projectsRepository.deleteWithOrphaning(project, userId);
        return { message: 'Project successfully deleted' };
    }
}

module.exports = new ProjectsService();
module.exports.updateProjectTags = updateProjectTags;
