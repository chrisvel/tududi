'use strict';

const { Matrix, TaskMatrix, Task, User } = require('../../../models');

describe('Matrix Model', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'model@example.com',
            password_digest:
                '$2b$10$DPcA0XSvK9FT04mLyKGza.uHb8d.bESwP.XdQfQ47.sKVT4fYzbP.',
        });
    });

    it('should create a matrix with valid data', async () => {
        const matrix = await Matrix.create({
            name: 'Test Matrix',
            user_id: user.id,
        });

        expect(matrix.id).toBeDefined();
        expect(matrix.uid).toBeDefined();
        expect(matrix.name).toBe('Test Matrix');
        expect(matrix.user_id).toBe(user.id);
    });

    it('should set default axis labels', async () => {
        const matrix = await Matrix.create({
            name: 'Defaults',
            user_id: user.id,
        });

        expect(matrix.x_axis_label_left).toBe('Low Effort');
        expect(matrix.x_axis_label_right).toBe('High Effort');
        expect(matrix.y_axis_label_top).toBe('High Impact');
        expect(matrix.y_axis_label_bottom).toBe('Low Impact');
    });

    it('should accept custom axis labels', async () => {
        const matrix = await Matrix.create({
            name: 'Custom',
            user_id: user.id,
            x_axis_label_left: 'Urgent',
            x_axis_label_right: 'Not Urgent',
            y_axis_label_top: 'Important',
            y_axis_label_bottom: 'Not Important',
        });

        expect(matrix.x_axis_label_left).toBe('Urgent');
        expect(matrix.y_axis_label_top).toBe('Important');
    });

    it('should generate a unique uid', async () => {
        const m1 = await Matrix.create({ name: 'A', user_id: user.id });
        const m2 = await Matrix.create({ name: 'B', user_id: user.id });

        expect(m1.uid).toBeDefined();
        expect(m2.uid).toBeDefined();
    });

    it('should reject a matrix without a name', async () => {
        await expect(
            Matrix.create({ user_id: user.id })
        ).rejects.toThrow();
    });

    it('should reject a matrix with an empty name', async () => {
        await expect(
            Matrix.create({ name: '', user_id: user.id })
        ).rejects.toThrow();
    });

    it('should allow null project_id', async () => {
        const matrix = await Matrix.create({
            name: 'No Project',
            user_id: user.id,
            project_id: null,
        });

        expect(matrix.project_id).toBeNull();
    });
});

describe('TaskMatrix Model', () => {
    let user, matrix, task;

    beforeEach(async () => {
        user = await User.create({
            email: 'tm@example.com',
            password_digest:
                '$2b$10$DPcA0XSvK9FT04mLyKGza.uHb8d.bESwP.XdQfQ47.sKVT4fYzbP.',
        });
        matrix = await Matrix.create({ name: 'M', user_id: user.id });
        task = await Task.create({ name: 'T', user_id: user.id });
    });

    it('should create a task-matrix association', async () => {
        const tm = await TaskMatrix.create({
            task_id: task.id,
            matrix_id: matrix.id,
            quadrant_index: 2,
            position: 1,
        });

        expect(tm.task_id).toBe(task.id);
        expect(tm.matrix_id).toBe(matrix.id);
        expect(tm.quadrant_index).toBe(2);
        expect(tm.position).toBe(1);
    });

    it('should default quadrant_index to 0', async () => {
        const tm = await TaskMatrix.create({
            task_id: task.id,
            matrix_id: matrix.id,
        });

        expect(tm.quadrant_index).toBe(0);
    });

    it('should default position to 0', async () => {
        const tm = await TaskMatrix.create({
            task_id: task.id,
            matrix_id: matrix.id,
        });

        expect(tm.position).toBe(0);
    });

    it('should reject quadrant_index > 3', async () => {
        await expect(
            TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: 4,
            })
        ).rejects.toThrow();
    });

    it('should reject negative quadrant_index', async () => {
        await expect(
            TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: -1,
            })
        ).rejects.toThrow();
    });

    it('should reject negative position', async () => {
        await expect(
            TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                position: -1,
            })
        ).rejects.toThrow();
    });
});
