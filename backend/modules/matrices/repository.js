'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const {
    Matrix,
    TaskMatrix,
    Task,
    Project,
    Tag,
    sequelize,
} = require('../../models');
const { Op } = require('sequelize');

class MatricesRepository extends BaseRepository {
    constructor() {
        super(Matrix);
    }

    /**
     * Get task IDs already assigned to a matrix.
     */
    async _getAssignedTaskIds(matrixId) {
        const rows = await TaskMatrix.findAll({
            where: { matrix_id: matrixId },
            attributes: ['task_id'],
            raw: true,
        });
        return rows.map((r) => r.task_id);
    }

    /**
     * Find all matrices for a user, optionally filtered by project.
     */
    async findAllForUser(userId, projectId) {
        const where = { user_id: userId };
        if (projectId) {
            where.project_id = projectId;
        }

        return this.model.findAll({
            where,
            include: [
                {
                    model: Project,
                    as: 'Project',
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
            ],
            attributes: {
                include: [
                    [
                        sequelize.literal(
                            '(SELECT COUNT(*) FROM task_matrices WHERE task_matrices.matrix_id = "Matrix"."id")'
                        ),
                        'taskCount',
                    ],
                ],
            },
            order: [['created_at', 'DESC']],
        });
    }

    /**
     * Find a matrix by ID with all tasks grouped data.
     */
    async findByIdWithTasks(matrixId, userId) {
        const matrix = await this.model.findOne({
            where: { id: matrixId, user_id: userId },
            include: [
                {
                    model: Task,
                    as: 'Tasks',
                    through: {
                        attributes: ['quadrant_index', 'position'],
                    },
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                        },
                    ],
                },
                {
                    model: Project,
                    as: 'Project',
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
            ],
        });

        return matrix;
    }

    /**
     * Find a matrix by ID scoped to user.
     */
    async findByIdForUser(matrixId, userId) {
        return this.model.findOne({
            where: { id: matrixId, user_id: userId },
        });
    }

    /**
     * Find unassigned tasks for a matrix.
     * - Project-linked: shows project tasks not yet in this matrix
     * - Standalone: shows all user tasks without a project, not yet in this matrix
     */
    async findUnassignedTasks(matrixId, projectId, userId) {
        const taskIds = await this._getAssignedTaskIds(matrixId);

        const where = {
            user_id: userId,
            status: { [Op.notIn]: [2, 3, 5] }, // Exclude done, archived, cancelled
        };

        if (projectId) {
            where.project_id = projectId;
        } else {
            where.project_id = { [Op.is]: null };
        }

        if (taskIds.length > 0) {
            where.id = { [Op.notIn]: taskIds };
        }

        return Task.findAll({
            where,
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
            ],
            order: [['name', 'ASC']],
        });
    }

    /**
     * Find or create a task-matrix association.
     */
    async findOrCreateTaskMatrix(taskId, matrixId, quadrantIndex, position) {
        return TaskMatrix.findOrCreate({
            where: { task_id: taskId, matrix_id: matrixId },
            defaults: {
                quadrant_index: quadrantIndex,
                position: position || 0,
            },
        });
    }

    /**
     * Update an existing task-matrix association.
     */
    async updateTaskMatrix(taskMatrix, data) {
        return taskMatrix.update(data);
    }

    /**
     * Find a task-matrix association.
     */
    async findTaskMatrix(taskId, matrixId) {
        return TaskMatrix.findOne({
            where: { task_id: taskId, matrix_id: matrixId },
        });
    }

    /**
     * Destroy a task-matrix association.
     */
    async destroyTaskMatrix(taskMatrix) {
        return taskMatrix.destroy();
    }

    /**
     * Find all matrix placements for a task.
     * Returns matrices with the task's quadrant info.
     */
    async findMatricesForTask(taskId, userId) {
        return TaskMatrix.findAll({
            where: { task_id: taskId },
            include: [
                {
                    model: Matrix,
                    as: 'Matrix',
                    where: { user_id: userId },
                    include: [
                        {
                            model: Project,
                            as: 'Project',
                            required: false,
                            attributes: ['id', 'uid', 'name'],
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Browse available tasks for a matrix, filtered by source category.
     * source: 'project' | 'area' | 'tag'
     * sourceId: the id of the project, area, or tag
     * Returns tasks NOT already placed in this matrix.
     */
    async findAvailableTasksByFilter(matrixId, userId, source, sourceId) {
        const taskIds = await this._getAssignedTaskIds(matrixId);

        const where = {
            user_id: userId,
            status: { [Op.notIn]: [2, 3, 5] }, // Exclude done, archived, cancelled
        };

        if (taskIds.length > 0) {
            where.id = { [Op.notIn]: taskIds };
        }

        // Tag include may require a `where` clause to filter by tag uid.
        const tagInclude = {
            model: Tag,
            attributes: ['id', 'name', 'uid'],
            through: { attributes: [] },
        };

        switch (source) {
            case 'project':
                where.project_id = parseInt(sourceId, 10);
                break;
            case 'area': {
                const areaId = parseInt(sourceId, 10);
                const areaProjects = await Project.findAll({
                    where: { area_id: areaId, user_id: userId },
                    attributes: ['id'],
                    raw: true,
                });
                if (areaProjects.length === 0) return [];
                where.project_id = { [Op.in]: areaProjects.map((p) => p.id) };
                break;
            }
            case 'tag':
                // sourceId is a tag uid (string) — filter via required Tag include
                tagInclude.where = { uid: sourceId };
                break;
            default:
                return [];
        }

        return Task.findAll({
            where,
            include: [tagInclude],
            order: [['name', 'ASC']],
            limit: 200,
        });
    }

    /**
     * Find all task-to-matrix placements for a user.
     * Returns a flat list: { task_id, matrix_id, quadrant_index, matrix_name }.
     */
    async findAllPlacementsForUser(userId) {
        return TaskMatrix.findAll({
            attributes: ['task_id', 'matrix_id', 'quadrant_index'],
            include: [
                {
                    model: Matrix,
                    as: 'Matrix',
                    where: { user_id: userId },
                    attributes: ['id', 'name'],
                },
            ],
            raw: true,
            nest: true,
        });
    }
}

module.exports = new MatricesRepository();
