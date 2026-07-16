'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { Op } = require('sequelize');
const { Task, sequelize } = require('../../models');
const templatesRepository = require('./repository');
const projectsRepository = require('../projects/repository');
const { validateUid, validateName } = require('./utils/validation');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { uid: generateUid } = require('../../utils/uid');
const { sortTags } = require('../tasks/core/serializers');
const { validateTagName } = require('../tags/tagsService');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');

async function updateTemplateTags(project, tagsData, userId) {
    if (!tagsData) return;

    const validTagNames = [];
    for (const tag of tagsData) {
        const validation = validateTagName(tag.name);
        if (validation.valid && !validTagNames.includes(validation.name)) {
            validTagNames.push(validation.name);
        }
    }

    if (validTagNames.length === 0) {
        await project.setTags([]);
        return;
    }

    const existingTags = await templatesRepository.findTagsByNames(
        userId,
        validTagNames
    );
    const existingTagNames = existingTags.map((t) => t.name);
    const newTagNames = validTagNames.filter(
        (n) => !existingTagNames.includes(n)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => templatesRepository.createTag(name, userId))
    );
    await project.setTags([...existingTags, ...createdTags]);
}

function applyDateOffset(dateValue, offsetMs) {
    if (!dateValue || !offsetMs) return dateValue;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return dateValue;
    return new Date(d.getTime() + offsetMs).toISOString();
}

function findEarliestDueDate(tasks) {
    let earliest = null;
    for (const task of tasks) {
        if (task.due_date) {
            const d = new Date(task.due_date);
            if (!isNaN(d.getTime()) && (!earliest || d < earliest)) {
                earliest = d;
            }
        }
        if (task.Subtasks) {
            for (const sub of task.Subtasks) {
                if (sub.due_date) {
                    const d = new Date(sub.due_date);
                    if (!isNaN(d.getTime()) && (!earliest || d < earliest)) {
                        earliest = d;
                    }
                }
            }
        }
    }
    return earliest;
}

function httpGet(urlStr, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(urlStr);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.get(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                headers,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve({
                            status: res.statusCode,
                            body: JSON.parse(data),
                        });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            }
        );
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Marketplace request timed out'));
        });
    });
}

class TemplatesService {
    async getAll(userId) {
        const templates = await templatesRepository.findAllTemplates(userId);
        return {
            templates: templates.map((t) => {
                const j = t.toJSON();
                const total = (j.Tasks || []).length;
                return {
                    ...j,
                    tags: sortTags(j.Tags),
                    task_count: total,
                };
            }),
        };
    }

    async getByUid(uid, userId) {
        const validatedUid = validateUid(uid);
        const template =
            await templatesRepository.findTemplateByUid(validatedUid);
        if (!template || template.user_id !== userId) {
            throw new NotFoundError('Template not found');
        }
        const j = template.toJSON();
        return {
            ...j,
            tags: sortTags(j.Tags),
            Tasks: (j.Tasks || []).map((task) => ({
                ...task,
                tags: sortTags(task.Tags),
                subtasks: (task.Subtasks || []).map((sub) => ({
                    ...sub,
                    tags: sortTags(sub.Tags),
                })),
            })),
        };
    }

    async create(userId, data) {
        const config = getConfig();
        const count = await templatesRepository.countByUser(userId);
        if (count >= config.maxTemplatesPerUser) {
            throw new ValidationError(
                `Template limit reached. Maximum ${config.maxTemplatesPerUser} templates allowed per user.`
            );
        }

        const { name, description, template_category, tags, Tags } = data;
        const validatedName = validateName(name);
        const tagsData = tags || Tags;
        const projectUid = generateUid();

        const project = await templatesRepository.create({
            uid: projectUid,
            name: validatedName,
            description: description || '',
            status: 'not_started',
            is_template: true,
            template_category: template_category || null,
            clone_count: 0,
            user_id: userId,
        });

        try {
            await updateTemplateTags(project, tagsData, userId);
        } catch (err) {
            logError('Tag update failed after template create:', err.message);
        }

        return { ...project.toJSON(), uid: projectUid, tags: [] };
    }

    async saveProjectAsTemplate(projectUid, userId, options = {}) {
        const config = getConfig();
        const count = await templatesRepository.countByUser(userId);
        if (count >= config.maxTemplatesPerUser) {
            throw new ValidationError(
                `Template limit reached. Maximum ${config.maxTemplatesPerUser} templates allowed per user.`
            );
        }

        const uid = validateUid(projectUid);
        const source = await projectsRepository.findByUidWithIncludes(uid);

        if (!source || source.user_id !== userId) {
            throw new NotFoundError('Project not found');
        }

        const templateUid = generateUid();
        const templateName = options.name || source.name;
        const sourceJson = source.toJSON();

        const template = await templatesRepository.create({
            uid: templateUid,
            name: templateName,
            description: source.description || '',
            status: 'not_started',
            is_template: true,
            template_category: options.category || null,
            clone_count: 0,
            user_id: userId,
        });

        await this._copyTasksToProject(source, template, userId, {
            resetStatus: true,
        });

        if (sourceJson.Tags && sourceJson.Tags.length > 0) {
            try {
                await updateTemplateTags(template, sourceJson.Tags, userId);
            } catch (err) {
                logError(
                    'Tag copy failed during save-as-template:',
                    err.message
                );
            }
        }

        return { ...template.toJSON(), uid: templateUid, tags: [] };
    }

    async cloneTemplate(templateUid, userId, options = {}) {
        const uid = validateUid(templateUid);
        const template = await templatesRepository.findTemplateByUid(uid);

        if (!template || template.user_id !== userId) {
            throw new NotFoundError('Template not found');
        }

        const templateJson = template.toJSON();
        const newName = options.name || `${template.name} (Copy)`;
        const projectUid = generateUid();

        let areaId = null;
        if (options.area_uid) {
            const area = await projectsRepository.findAreaByUid(
                options.area_uid
            );
            areaId = area ? area.id : null;
        }

        const newProject = await projectsRepository.create({
            uid: projectUid,
            name: newName,
            description: template.description || '',
            status: 'not_started',
            is_template: false,
            source_template_id: template.id,
            area_id: areaId,
            user_id: userId,
        });

        await this._copyTasksToProject(template, newProject, userId, {
            resetStatus: options.resetStatus !== false,
            startDate: options.startDate,
        });

        if (templateJson.Tags && templateJson.Tags.length > 0) {
            try {
                await updateTemplateTags(newProject, templateJson.Tags, userId);
            } catch (err) {
                logError('Tag copy failed during clone:', err.message);
            }
        }

        await templatesRepository.incrementCloneCount(template.id);

        return { ...newProject.toJSON(), uid: projectUid, tags: [] };
    }

    async _copyTasksToProject(
        sourceProject,
        targetProject,
        userId,
        options = {}
    ) {
        const sourceJson = sourceProject.toJSON
            ? sourceProject.toJSON()
            : sourceProject;
        const parentTasks = (sourceJson.Tasks || []).filter(
            (t) => !t.parent_task_id
        );

        let offsetMs = 0;
        if (options.startDate && parentTasks.length > 0) {
            const allTasks = sourceJson.Tasks || [];
            const earliest = findEarliestDueDate(allTasks);
            if (earliest) {
                offsetMs =
                    new Date(options.startDate).getTime() - earliest.getTime();
            }
        }

        const idMap = {};

        await sequelize.transaction(async (transaction) => {
            for (const task of parentTasks) {
                const newTaskUid = generateUid();
                const newTask = await Task.create(
                    {
                        uid: newTaskUid,
                        name: task.name,
                        note: task.note || null,
                        priority: task.priority ?? null,
                        status: options.resetStatus ? 0 : task.status,
                        due_date: applyDateOffset(task.due_date, offsetMs),
                        project_id: targetProject.id,
                        user_id: userId,
                        recurrence_type: 'none',
                    },
                    { transaction }
                );

                idMap[task.id] = newTask.id;

                if (task.Tags && task.Tags.length > 0) {
                    const tagNames = task.Tags.map((tg) => tg.name);
                    const existingTags =
                        await templatesRepository.findTagsByNames(
                            userId,
                            tagNames
                        );
                    const existingNames = existingTags.map((tg) => tg.name);
                    const newTagNames = tagNames.filter(
                        (n) => !existingNames.includes(n)
                    );
                    const createdTags = await Promise.all(
                        newTagNames.map((n) =>
                            templatesRepository.createTag(n, userId)
                        )
                    );
                    await newTask.setTags([...existingTags, ...createdTags], {
                        transaction,
                    });
                }

                const nestedSubtasks = task.Subtasks || task.subtasks || [];
                if (nestedSubtasks.length > 0) {
                    for (const sub of nestedSubtasks) {
                        await Task.create(
                            {
                                uid: generateUid(),
                                name: sub.name,
                                note: sub.note || null,
                                priority: sub.priority ?? null,
                                status: options.resetStatus ? 0 : sub.status,
                                due_date: applyDateOffset(
                                    sub.due_date,
                                    offsetMs
                                ),
                                project_id: targetProject.id,
                                parent_task_id: newTask.id,
                                user_id: userId,
                                recurrence_type: 'none',
                            },
                            { transaction }
                        );
                    }
                }
            }

            const subtasks = (sourceJson.Tasks || []).filter(
                (t) => t.parent_task_id
            );
            for (const sub of subtasks) {
                const newParentId = idMap[sub.parent_task_id];
                if (!newParentId) continue;
                await Task.create(
                    {
                        uid: generateUid(),
                        name: sub.name,
                        note: sub.note || null,
                        priority: sub.priority ?? null,
                        status: options.resetStatus ? 0 : sub.status,
                        due_date: applyDateOffset(sub.due_date, offsetMs),
                        project_id: targetProject.id,
                        parent_task_id: newParentId,
                        user_id: userId,
                        recurrence_type: 'none',
                    },
                    { transaction }
                );
            }

            if (sourceJson.Subtasks) {
                for (const sub of sourceJson.Subtasks) {
                    const newParentId = idMap[sub.parent_task_id];
                    if (!newParentId) continue;
                    await Task.create(
                        {
                            uid: generateUid(),
                            name: sub.name,
                            note: sub.note || null,
                            priority: sub.priority ?? null,
                            status: options.resetStatus ? 0 : sub.status,
                            due_date: applyDateOffset(sub.due_date, offsetMs),
                            project_id: targetProject.id,
                            parent_task_id: newParentId,
                            user_id: userId,
                            recurrence_type: 'none',
                        },
                        { transaction }
                    );
                }
            }
        });
    }

    async update(uid, userId, data) {
        const validatedUid = validateUid(uid);
        const template = await templatesRepository.findOne({
            uid: validatedUid,
            is_template: true,
        });

        if (!template || template.user_id !== userId) {
            throw new NotFoundError('Template not found');
        }

        const updateData = {};
        if (data.name !== undefined) updateData.name = validateName(data.name);
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.template_category !== undefined)
            updateData.template_category = data.template_category || null;

        await templatesRepository.update(template, updateData);

        if (data.tags !== undefined || data.Tags !== undefined) {
            try {
                await updateTemplateTags(
                    template,
                    data.tags || data.Tags,
                    userId
                );
            } catch (err) {
                logError(
                    'Tag update failed during template update:',
                    err.message
                );
            }
        }

        return { ...template.toJSON(), uid: validatedUid };
    }

    async delete(uid, userId) {
        const validatedUid = validateUid(uid);
        const template = await templatesRepository.findOne({
            uid: validatedUid,
            is_template: true,
        });

        if (!template || template.user_id !== userId) {
            throw new NotFoundError('Template not found');
        }

        await Task.destroy({
            where: { project_id: template.id, user_id: userId },
        });
        await template.destroy();

        return { message: 'Template deleted' };
    }

    async fetchMarketplaceTemplates(query) {
        const config = getConfig();
        const marketplaceUrl = config.marketplaceUrl;
        if (!marketplaceUrl) return { templates: [] };

        const qs = new URLSearchParams(query).toString();
        const url = `${marketplaceUrl}/api/marketplace/templates${qs ? '?' + qs : ''}`;

        try {
            const headers = {};
            if (config.marketplaceApiKey) {
                headers['Authorization'] = `Bearer ${config.marketplaceApiKey}`;
            }
            const response = await httpGet(url, headers);
            if (response.status !== 200) return { templates: [] };
            return response.body;
        } catch (err) {
            logError('Marketplace fetch failed:', err.message);
            return { templates: [] };
        }
    }

    async fetchMarketplaceTemplate(uid) {
        const config = getConfig();
        const marketplaceUrl = config.marketplaceUrl;
        if (!marketplaceUrl)
            throw new NotFoundError('Marketplace not configured');

        const url = `${marketplaceUrl}/api/marketplace/templates/${uid}`;
        try {
            const headers = {};
            if (config.marketplaceApiKey) {
                headers['Authorization'] = `Bearer ${config.marketplaceApiKey}`;
            }
            const response = await httpGet(url, headers);
            if (response.status === 404)
                throw new NotFoundError('Template not found in marketplace');
            if (response.status !== 200) throw new Error('Marketplace error');
            return response.body;
        } catch (err) {
            if (err instanceof NotFoundError) throw err;
            logError('Marketplace template fetch failed:', err.message);
            throw new Error('Failed to fetch marketplace template');
        }
    }

    async installMarketplaceTemplate(marketplaceUid, userId) {
        const config = getConfig();
        const count = await templatesRepository.countByUser(userId);
        if (count >= config.maxTemplatesPerUser) {
            throw new ValidationError(
                `Template limit reached. Maximum ${config.maxTemplatesPerUser} templates allowed per user.`
            );
        }

        const marketplaceUrl = config.marketplaceUrl;
        if (!marketplaceUrl)
            throw new ValidationError('Marketplace not configured');

        const url = `${marketplaceUrl}/api/marketplace/templates/${marketplaceUid}/install-data`;
        const headers = {};
        if (config.marketplaceApiKey) {
            headers['Authorization'] = `Bearer ${config.marketplaceApiKey}`;
        }

        let response;
        try {
            response = await httpGet(url, headers);
        } catch (err) {
            logError('Marketplace install-data fetch failed:', err.message);
            throw new Error('Failed to fetch template from marketplace');
        }

        if (response.status === 403)
            throw new ValidationError(
                'Access denied. An active subscription is required for paid templates.'
            );
        if (response.status === 404)
            throw new NotFoundError('Template not found in marketplace');
        if (response.status !== 200) throw new Error('Marketplace error');

        const templateData = response.body;

        const templateUid = generateUid();
        const template = await templatesRepository.create({
            uid: templateUid,
            name: templateData.name || 'Marketplace Template',
            description: templateData.description || '',
            status: 'not_started',
            is_template: true,
            template_category: templateData.category || null,
            clone_count: 0,
            user_id: userId,
        });

        if (templateData.structure && templateData.structure.tasks) {
            const fakeSource = {
                Tasks: templateData.structure.tasks,
                Subtasks: [],
            };
            await this._copyTasksToProject(fakeSource, template, userId, {
                resetStatus: true,
            });
        }

        return { ...template.toJSON(), uid: templateUid, tags: [] };
    }
}

module.exports = new TemplatesService();
