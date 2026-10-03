'use strict';

const { createHash } = require('crypto');
const { UniqueConstraintError } = require('sequelize');
const { sequelize, Project, CaptureReceipt } = require('../../models');
const { parseTaskCapture } = require('../../shared/captureSyntax');
const { ValidationError, ConflictError } = require('../../shared/errors');
const permissionsService = require('../../services/permissionsService');
const entitlements = require('../../services/entitlementsService');
const { createTask } = require('../tasks/operations/create');
const taskRepository = require('../tasks/repository');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('../tasks/utils/constants');
const { serializeTask } = require('../tasks/core/serializers');
const inboxService = require('./service');
const { validateContent, validateSource } = require('./validation');

function invalid(code, message) {
    const error = new ValidationError(message);
    error.code = code;
    return error;
}

async function resolveProject(userId, names) {
    if (names.length > 1) {
        throw invalid(
            'CAPTURE_MULTIPLE_PROJECTS',
            'Use only one project reference for a task.'
        );
    }
    if (!names.length) return undefined;
    const accessible = await Project.findAll({
        where: await permissionsService.ownershipOrPermissionWhere(
            'project',
            userId
        ),
    });
    const matches = accessible.filter(
        (project) => project.name.toLowerCase() === names[0].toLowerCase()
    );
    const writable = [];
    for (const project of matches) {
        const access = await permissionsService.getAccess(
            userId,
            'project',
            project.uid
        );
        if (
            project.user_id === userId ||
            access === 'rw' ||
            access === 'admin'
        ) {
            writable.push(project);
        }
    }
    if (!writable.length) {
        throw invalid(
            'CAPTURE_PROJECT_UNAVAILABLE',
            'The referenced project does not exist or you cannot add tasks to it.'
        );
    }
    if (writable.length > 1) {
        throw invalid(
            'CAPTURE_PROJECT_AMBIGUOUS',
            'More than one writable project has that name. Use a unique project name.'
        );
    }
    return writable[0].uid;
}

const hash = (value) => createHash('sha256').update(value).digest('hex');

// Reusable by Telegram: use a stable delivery ID as request_id. The receipt
// and entity commit together, including tags. A failed attempt commits neither.
async function capture(
    user,
    { content, source, request_id, force_inbox = false }
) {
    const text = validateContent(content);
    const captureSource = validateSource(source);
    if (
        typeof request_id !== 'string' ||
        !/^[a-zA-Z0-9:_-]{1,128}$/.test(request_id)
    ) {
        throw new ValidationError('A valid capture request_id is required.');
    }
    if (typeof force_inbox !== 'boolean') {
        throw new ValidationError('force_inbox must be a boolean.');
    }
    const where = {
        user_id: user.id,
        request_key: hash(JSON.stringify([captureSource, request_id])),
    };
    const fingerprint = hash(JSON.stringify([text, force_inbox]));
    const replay = (receipt) => {
        if (receipt.fingerprint !== fingerprint) {
            throw new ConflictError(
                'This capture request ID was already used for different content.'
            );
        }
        return receipt.result;
    };
    const previous = await CaptureReceipt.findOne({ where });
    if (previous) return replay(previous);

    try {
        return await sequelize.transaction(async (transaction) => {
            // Insert first: the unique key also serializes concurrent deliveries.
            const receipt = await CaptureReceipt.create(
                { ...where, fingerprint },
                { transaction }
            );
            const parsed = force_inbox ? null : parseTaskCapture(text);
            let result;
            if (parsed) {
                if (!parsed.name) {
                    throw invalid(
                        'CAPTURE_EMPTY_TITLE',
                        'Enter a task name in addition to the directive and metadata.'
                    );
                }
                const projectUid = await resolveProject(
                    user.id,
                    parsed.projects
                );
                await entitlements.assertCanCreate(user.id, 'task', 1);
                const task = await createTask(
                    {
                        name: parsed.name,
                        project_uid: projectUid,
                        tags: parsed.tags,
                        status: 'not_started',
                    },
                    user,
                    { transaction }
                );
                const loaded = await taskRepository.findById(task.id, {
                    include: TASK_INCLUDES_WITH_SUBTASKS,
                    transaction,
                });
                result = {
                    kind: 'task',
                    task: await serializeTask(
                        loaded,
                        user.timezone,
                        { skipDisplayNameTransform: true },
                        {}
                    ),
                };
            } else {
                result = {
                    kind: 'inbox',
                    item: await inboxService.create(
                        user.id,
                        { content: text, source: captureSource },
                        { transaction }
                    ),
                };
            }
            await receipt.update({ result }, { transaction });
            return result;
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            const receipt = await CaptureReceipt.findOne({ where });
            if (receipt) return replay(receipt);
        }
        throw error;
    }
}

module.exports = { capture };
