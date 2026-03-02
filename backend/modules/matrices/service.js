'use strict';

const matricesRepository = require('./repository');
const {
    validateName,
    validateAxisLabel,
    validateQuadrantIndex,
    validatePosition,
} = require('./validation');
const {
    NotFoundError,
    ValidationError,
} = require('../../shared/errors');
const { Task, Project } = require('../../models');

/** Fields that hold axis labels on a matrix. */
const AXIS_FIELDS = [
    'x_axis_label_left',
    'x_axis_label_right',
    'y_axis_label_top',
    'y_axis_label_bottom',
];

/**
 * Validate axis labels and copy present fields into target object.
 * When `requirePresence` is true the labels are validated even if undefined.
 */
function applyAxisLabels(source, target, requirePresence = false) {
    for (const field of AXIS_FIELDS) {
        if (requirePresence || source[field] !== undefined) {
            validateAxisLabel(source[field], field);
            if (source[field] !== undefined && source[field] !== null) {
                target[field] = source[field];
            }
        }
    }
}


class MatricesService {
    /**
     * List all matrices for a user.
     */
    async getAll(userId, query = {}) {
        const { project_id } = query;
        const matrices = await matricesRepository.findAllForUser(
            userId,
            project_id
        );

        return {
            success: true,
            data: matrices.map((m) => this._serializeMatrix(m)),
        };
    }

    /**
     * Get a single matrix with tasks grouped by quadrant.
     */
    async getById(matrixId, userId) {
        const matrix =
            await matricesRepository.findByIdWithTasks(matrixId, userId);

        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        // Group tasks by quadrant
        const quadrants = { 0: [], 1: [], 2: [], 3: [] };
        const tasks = matrix.Tasks || [];
        for (const task of tasks) {
            const qi = task.TaskMatrix?.quadrant_index ?? 0;
            quadrants[qi].push(this._serializeTask(task));
        }

        // Get unassigned tasks if project-linked
        const unassigned = await matricesRepository.findUnassignedTasks(
            matrixId,
            matrix.project_id,
            userId
        );

        return {
            success: true,
            data: {
                ...this._serializeMatrix(matrix),
                quadrants,
                unassigned: unassigned.map((t) => this._serializeTask(t)),
            },
        };
    }

    /**
     * Create a new matrix.
     */
    async create(userId, data) {
        const name = validateName(data.name);

        // Validate project_id if provided
        if (data.project_id) {
            const project = await Project.findOne({
                where: { id: data.project_id, user_id: userId },
            });
            if (!project) {
                throw new NotFoundError('Project not found.');
            }
        }

        const matrixData = {
            name,
            user_id: userId,
            project_id: data.project_id || null,
        };

        applyAxisLabels(data, matrixData, true);

        const matrix = await matricesRepository.create(matrixData);

        return {
            success: true,
            data: this._serializeMatrix(matrix),
        };
    }

    /**
     * Update an existing matrix.
     */
    async update(matrixId, userId, data) {
        const matrix = await matricesRepository.findByIdForUser(
            matrixId,
            userId
        );

        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        const updateData = {};

        if (data.name !== undefined) {
            updateData.name = validateName(data.name);
        }

        // Allow changing the linked project (or unlinking)
        if (data.project_id !== undefined) {
            if (data.project_id) {
                const project = await Project.findOne({
                    where: { id: data.project_id, user_id: userId },
                });
                if (!project) {
                    throw new NotFoundError('Project not found.');
                }
                updateData.project_id = data.project_id;
            } else {
                updateData.project_id = null;
            }
        }

        applyAxisLabels(data, updateData);

        await matricesRepository.update(matrix, updateData);

        return {
            success: true,
            data: this._serializeMatrix(matrix),
        };
    }

    /**
     * Delete a matrix.
     */
    async delete(matrixId, userId) {
        const matrix = await matricesRepository.findByIdForUser(
            matrixId,
            userId
        );

        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        await matricesRepository.destroy(matrix);

        return {
            success: true,
            message: 'Matrix deleted successfully.',
        };
    }

    /**
     * Assign or move a task in a matrix.
     */
    async assignTask(matrixId, taskId, userId, data) {
        const quadrantIndex = validateQuadrantIndex(data.quadrant_index);
        const position = validatePosition(data.position);

        // Verify matrix belongs to user
        const matrix = await matricesRepository.findByIdForUser(
            matrixId,
            userId
        );
        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        // Verify task belongs to user
        const task = await Task.findOne({
            where: { id: taskId, user_id: userId },
        });
        if (!task) {
            throw new NotFoundError('Matrix or Task not found.');
        }

        const [taskMatrix, created] =
            await matricesRepository.findOrCreateTaskMatrix(
                taskId,
                matrixId,
                quadrantIndex,
                position
            );

        if (!created) {
            await matricesRepository.updateTaskMatrix(taskMatrix, {
                quadrant_index: quadrantIndex,
                position,
            });
        }

        return {
            success: true,
            created,
            data: {
                task_id: parseInt(taskId, 10),
                matrix_id: parseInt(matrixId, 10),
                quadrant_index: quadrantIndex,
                position,
                created_at: taskMatrix.created_at,
                updated_at: taskMatrix.updated_at,
            },
            message: created
                ? 'Task added to matrix.'
                : 'Task moved to new quadrant.',
        };
    }

    /**
     * Remove a task from a matrix.
     */
    async removeTask(matrixId, taskId, userId) {
        // Verify matrix belongs to user
        const matrix = await matricesRepository.findByIdForUser(
            matrixId,
            userId
        );
        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        const taskMatrix = await matricesRepository.findTaskMatrix(
            taskId,
            matrixId
        );
        if (!taskMatrix) {
            throw new NotFoundError('Task is not in this matrix.');
        }

        await matricesRepository.destroyTaskMatrix(taskMatrix);

        return {
            success: true,
            message: 'Task removed from matrix.',
        };
    }

    /**
     * Get all matrix placements for a task.
     */
    async getTaskMatrices(taskId, userId) {
        const placements = await matricesRepository.findMatricesForTask(
            taskId,
            userId
        );

        return {
            success: true,
            data: placements.map((tm) => ({
                matrix: this._serializeMatrix(tm.Matrix),
                quadrant_index: tm.quadrant_index,
                position: tm.position,
            })),
        };
    }

    /**
     * Browse available tasks for a matrix, filtered by source category.
     */
    async browseAvailableTasks(matrixId, userId, source, sourceId) {
        if (!source || !sourceId) {
            throw new ValidationError('source and sourceId are required.');
        }
        const validSources = ['project', 'area', 'tag'];
        if (!validSources.includes(source)) {
            throw new ValidationError(`source must be one of: ${validSources.join(', ')}`);
        }

        // Verify matrix belongs to user
        const matrix = await matricesRepository.findByIdForUser(matrixId, userId);
        if (!matrix) {
            throw new NotFoundError('Matrix not found.');
        }

        const tasks = await matricesRepository.findAvailableTasksByFilter(
            matrixId, userId, source, sourceId
        );

        return {
            success: true,
            data: tasks.map((t) => this._serializeTask(t)),
        };
    }

    /**
     * Get all task placements for a user (bulk, for dot indicators).
     */
    async getAllPlacements(userId) {
        const placements = await matricesRepository.findAllPlacementsForUser(userId);

        return {
            success: true,
            data: placements.map((p) => ({
                task_id: p.task_id,
                matrix_id: p.matrix_id,
                quadrant_index: p.quadrant_index,
                matrix_name: p.Matrix ? p.Matrix.name : null,
            })),
        };
    }

    /**
     * Serialize a matrix model instance.
     */
    _serializeMatrix(matrix) {
        const data = {
            id: matrix.id,
            uid: matrix.uid,
            name: matrix.name,
            project_id: matrix.project_id,
            user_id: matrix.user_id,
            x_axis_label_left: matrix.x_axis_label_left,
            x_axis_label_right: matrix.x_axis_label_right,
            y_axis_label_top: matrix.y_axis_label_top,
            y_axis_label_bottom: matrix.y_axis_label_bottom,
            created_at: matrix.created_at,
            updated_at: matrix.updated_at,
        };

        // Include project info if eager-loaded
        if (matrix.Project) {
            data.project = {
                id: matrix.Project.id,
                uid: matrix.Project.uid,
                name: matrix.Project.name,
            };
        }

        // Include taskCount if computed
        const taskCount = matrix.getDataValue
            ? matrix.getDataValue('taskCount')
            : undefined;
        if (taskCount !== undefined) {
            data.taskCount = parseInt(taskCount, 10);
        }

        return data;
    }

    /**
     * Serialize a task for matrix responses.
     */
    _serializeTask(task) {
        const serialized = {
            id: task.id,
            uid: task.uid,
            name: task.name,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            project_id: task.project_id,
            tags: (task.Tags || []).map((t) => ({
                id: t.id,
                uid: t.uid,
                name: t.name,
            })),
        };

        // Include join table data if present
        if (task.TaskMatrix) {
            serialized.TaskMatrix = {
                quadrant_index: task.TaskMatrix.quadrant_index,
                position: task.TaskMatrix.position,
            };
        }

        return serialized;
    }
}

module.exports = new MatricesService();
