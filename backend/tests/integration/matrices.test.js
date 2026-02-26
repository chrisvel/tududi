'use strict';

const request = require('supertest');
const app = require('../../app');
const { Matrix, TaskMatrix, Task, Project, Tag, Area } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Matrices Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'matrix@example.com' });
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: 'matrix@example.com', password: 'password123' });
    });

    // ----------------------------------------------------------------
    // POST /api/matrices
    // ----------------------------------------------------------------
    describe('POST /api/matrices', () => {
        it('should create a matrix with name only', async () => {
            const res = await agent.post('/api/matrices').send({
                name: 'Eisenhower',
            });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Eisenhower');
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.uid).toBeDefined();
            expect(res.body.data.user_id).toBe(user.id);
        });

        it('should create a matrix with axis labels', async () => {
            const res = await agent.post('/api/matrices').send({
                name: 'Priority',
                x_axis_label_left: 'Urgent',
                x_axis_label_right: 'Not Urgent',
                y_axis_label_top: 'Important',
                y_axis_label_bottom: 'Not Important',
            });

            expect(res.status).toBe(201);
            expect(res.body.data.x_axis_label_left).toBe('Urgent');
            expect(res.body.data.x_axis_label_right).toBe('Not Urgent');
            expect(res.body.data.y_axis_label_top).toBe('Important');
            expect(res.body.data.y_axis_label_bottom).toBe('Not Important');
        });

        it('should create a matrix linked to a project', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
            });

            const res = await agent.post('/api/matrices').send({
                name: 'Project Matrix',
                project_id: project.id,
            });

            expect(res.status).toBe(201);
            expect(res.body.data.project_id).toBe(project.id);
        });

        it('should reject if name is missing', async () => {
            const res = await agent.post('/api/matrices').send({});

            expect(res.status).toBe(400);
        });

        it('should reject if name is empty', async () => {
            const res = await agent.post('/api/matrices').send({ name: '' });

            expect(res.status).toBe(400);
        });

        it('should reject if project does not belong to user', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const project = await Project.create({
                name: 'Other Project',
                user_id: otherUser.id,
            });

            const res = await agent.post('/api/matrices').send({
                name: 'Stolen Matrix',
                project_id: project.id,
            });

            expect(res.status).toBe(404);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/matrices')
                .send({ name: 'Anon Matrix' });

            expect(res.status).toBe(401);
        });
    });

    // ----------------------------------------------------------------
    // GET /api/matrices
    // ----------------------------------------------------------------
    describe('GET /api/matrices', () => {
        beforeEach(async () => {
            await Matrix.create({
                name: 'Matrix A',
                user_id: user.id,
            });
            await Matrix.create({
                name: 'Matrix B',
                user_id: user.id,
            });
        });

        it('should list all matrices for the user', async () => {
            const res = await agent.get('/api/matrices');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
        });

        it('should not include matrices from other users', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            await Matrix.create({
                name: 'Other Matrix',
                user_id: otherUser.id,
            });

            const res = await agent.get('/api/matrices');

            expect(res.body.data).toHaveLength(2);
        });

        it('should filter by project_id', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: user.id,
            });
            await Matrix.create({
                name: 'Project Matrix',
                user_id: user.id,
                project_id: project.id,
            });

            const res = await agent.get(
                `/api/matrices?project_id=${project.id}`
            );

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Project Matrix');
        });

        it('should include taskCount', async () => {
            const matrix = await Matrix.create({
                name: 'Counted',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'T1',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });

            const res = await agent.get('/api/matrices');

            const counted = res.body.data.find((m) => m.name === 'Counted');
            expect(counted.taskCount).toBe(1);
        });

        it('should require authentication', async () => {
            const res = await request(app).get('/api/matrices');

            expect(res.status).toBe(401);
        });
    });

    // ----------------------------------------------------------------
    // GET /api/matrices/:matrixId
    // ----------------------------------------------------------------
    describe('GET /api/matrices/:matrixId', () => {
        it('should return matrix with tasks grouped by quadrant', async () => {
            const matrix = await Matrix.create({
                name: 'Detail',
                user_id: user.id,
                x_axis_label_left: 'Left',
                x_axis_label_right: 'Right',
                y_axis_label_top: 'Top',
                y_axis_label_bottom: 'Bottom',
            });
            const t1 = await Task.create({
                name: 'Task A',
                user_id: user.id,
            });
            const t2 = await Task.create({
                name: 'Task B',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: t1.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });
            await TaskMatrix.create({
                task_id: t2.id,
                matrix_id: matrix.id,
                quadrant_index: 2,
            });

            const res = await agent.get(`/api/matrices/${matrix.id}`);

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Detail');
            expect(res.body.data.quadrants['0']).toHaveLength(1);
            expect(res.body.data.quadrants['1']).toHaveLength(0);
            expect(res.body.data.quadrants['2']).toHaveLength(1);
            expect(res.body.data.quadrants['3']).toHaveLength(0);
            expect(res.body.data.quadrants['0'][0].name).toBe('Task A');
        });

        it('should include unassigned tasks when project-linked', async () => {
            const project = await Project.create({
                name: 'P',
                user_id: user.id,
            });
            const matrix = await Matrix.create({
                name: 'ProjMatrix',
                user_id: user.id,
                project_id: project.id,
            });
            const assigned = await Task.create({
                name: 'Assigned',
                user_id: user.id,
                project_id: project.id,
            });
            const unassigned = await Task.create({
                name: 'Unassigned',
                user_id: user.id,
                project_id: project.id,
            });
            await TaskMatrix.create({
                task_id: assigned.id,
                matrix_id: matrix.id,
                quadrant_index: 1,
            });

            const res = await agent.get(`/api/matrices/${matrix.id}`);

            expect(res.body.data.quadrants['1']).toHaveLength(1);
            expect(res.body.data.unassigned).toHaveLength(1);
            expect(res.body.data.unassigned[0].name).toBe('Unassigned');
        });

        it('should return 404 for non-existent matrix', async () => {
            const res = await agent.get('/api/matrices/99999');

            expect(res.status).toBe(404);
        });

        it('should not allow access to another user\'s matrix', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const matrix = await Matrix.create({
                name: 'Private',
                user_id: otherUser.id,
            });

            const res = await agent.get(`/api/matrices/${matrix.id}`);

            expect(res.status).toBe(404);
        });
    });

    // ----------------------------------------------------------------
    // PUT /api/matrices/:matrixId
    // ----------------------------------------------------------------
    describe('PUT /api/matrices/:matrixId', () => {
        let matrix;

        beforeEach(async () => {
            matrix = await Matrix.create({
                name: 'Original',
                user_id: user.id,
                x_axis_label_left: 'Left',
            });
        });

        it('should update matrix name', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}`)
                .send({ name: 'Updated' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated');
        });

        it('should update axis labels', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}`)
                .send({ y_axis_label_top: 'High Impact' });

            expect(res.status).toBe(200);
            expect(res.body.data.y_axis_label_top).toBe('High Impact');
        });

        it('should return 404 for non-existent matrix', async () => {
            const res = await agent
                .put('/api/matrices/99999')
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404);
        });

        it('should reject empty name', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}`)
                .send({ name: '' });

            expect(res.status).toBe(400);
        });
    });

    // ----------------------------------------------------------------
    // DELETE /api/matrices/:matrixId
    // ----------------------------------------------------------------
    describe('DELETE /api/matrices/:matrixId', () => {
        it('should delete a matrix', async () => {
            const matrix = await Matrix.create({
                name: 'Doomed',
                user_id: user.id,
            });

            const res = await agent.delete(`/api/matrices/${matrix.id}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const found = await Matrix.findByPk(matrix.id);
            expect(found).toBeNull();
        });

        it('should return 404 for non-existent matrix', async () => {
            const res = await agent.delete('/api/matrices/99999');

            expect(res.status).toBe(404);
        });

        it('should not delete another user\'s matrix', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const matrix = await Matrix.create({
                name: 'Safe',
                user_id: otherUser.id,
            });

            const res = await agent.delete(`/api/matrices/${matrix.id}`);

            expect(res.status).toBe(404);

            const found = await Matrix.findByPk(matrix.id);
            expect(found).not.toBeNull();
        });
    });

    // ----------------------------------------------------------------
    // PUT /api/matrices/:matrixId/tasks/:taskId — Assign task
    // ----------------------------------------------------------------
    describe('PUT /api/matrices/:matrixId/tasks/:taskId', () => {
        let matrix, task;

        beforeEach(async () => {
            matrix = await Matrix.create({
                name: 'Assign Test',
                user_id: user.id,
            });
            task = await Task.create({
                name: 'My Task',
                user_id: user.id,
            });
        });

        it('should assign a task to a quadrant', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${task.id}`)
                .send({ quadrant_index: 0 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.quadrant_index).toBe(0);
            expect(res.body.data.task_id).toBe(task.id);
            expect(res.body.data.matrix_id).toBe(matrix.id);
        });

        it('should move a task to a different quadrant', async () => {
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });

            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${task.id}`)
                .send({ quadrant_index: 3 });

            expect(res.status).toBe(200);
            expect(res.body.data.quadrant_index).toBe(3);
        });

        it('should reject invalid quadrant_index', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${task.id}`)
                .send({ quadrant_index: 5 });

            expect(res.status).toBe(400);
        });

        it('should reject missing quadrant_index', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${task.id}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent matrix', async () => {
            const res = await agent
                .put(`/api/matrices/99999/tasks/${task.id}`)
                .send({ quadrant_index: 0 });

            expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent task', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/99999`)
                .send({ quadrant_index: 0 });

            expect(res.status).toBe(404);
        });

        it('should not assign another user\'s task', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const otherTask = await Task.create({
                name: 'Not yours',
                user_id: otherUser.id,
            });

            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${otherTask.id}`)
                .send({ quadrant_index: 1 });

            expect(res.status).toBe(404);
        });

        it('should accept position parameter', async () => {
            const res = await agent
                .put(`/api/matrices/${matrix.id}/tasks/${task.id}`)
                .send({ quadrant_index: 2, position: 5 });

            expect(res.status).toBe(201);
            expect(res.body.data.position).toBe(5);
        });
    });

    // ----------------------------------------------------------------
    // DELETE /api/matrices/:matrixId/tasks/:taskId — Remove task
    // ----------------------------------------------------------------
    describe('DELETE /api/matrices/:matrixId/tasks/:taskId', () => {
        it('should remove a task from a matrix', async () => {
            const matrix = await Matrix.create({
                name: 'Remove Test',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'Removable',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: 1,
            });

            const res = await agent.delete(
                `/api/matrices/${matrix.id}/tasks/${task.id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const found = await TaskMatrix.findOne({
                where: { task_id: task.id, matrix_id: matrix.id },
            });
            expect(found).toBeNull();
        });

        it('should return 404 if task is not in matrix', async () => {
            const matrix = await Matrix.create({
                name: 'M',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'T',
                user_id: user.id,
            });

            const res = await agent.delete(
                `/api/matrices/${matrix.id}/tasks/${task.id}`
            );

            expect(res.status).toBe(404);
        });

        it('should not affect the task itself', async () => {
            const matrix = await Matrix.create({
                name: 'M',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'Survivor',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });

            await agent.delete(
                `/api/matrices/${matrix.id}/tasks/${task.id}`
            );

            const found = await Task.findByPk(task.id);
            expect(found).not.toBeNull();
            expect(found.name).toBe('Survivor');
        });
    });

    // ----------------------------------------------------------------
    // GET /api/tasks/:taskId/matrices — Task placements
    // ----------------------------------------------------------------
    describe('GET /api/tasks/:taskId/matrices', () => {
        it('should return all matrix placements for a task', async () => {
            const task = await Task.create({
                name: 'Multi',
                user_id: user.id,
            });
            const m1 = await Matrix.create({
                name: 'M1',
                user_id: user.id,
                y_axis_label_top: 'Top',
            });
            const m2 = await Matrix.create({
                name: 'M2',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: m1.id,
                quadrant_index: 0,
            });
            await TaskMatrix.create({
                task_id: task.id,
                matrix_id: m2.id,
                quadrant_index: 3,
            });

            const res = await agent.get(`/api/tasks/${task.id}/matrices`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].matrix.name).toBeDefined();
            expect(res.body.data[0].quadrant_index).toBeDefined();
        });

        it('should return empty array for task with no placements', async () => {
            const task = await Task.create({
                name: 'Alone',
                user_id: user.id,
            });

            const res = await agent.get(`/api/tasks/${task.id}/matrices`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });

    // ----------------------------------------------------------------
    // GET /api/matrices/placements — Bulk placements
    // ----------------------------------------------------------------
    describe('GET /api/matrices/placements', () => {
        it('should return all placements for the user', async () => {
            const matrix = await Matrix.create({
                name: 'Bulk',
                user_id: user.id,
            });
            const t1 = await Task.create({
                name: 'T1',
                user_id: user.id,
            });
            const t2 = await Task.create({
                name: 'T2',
                user_id: user.id,
            });
            await TaskMatrix.create({
                task_id: t1.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });
            await TaskMatrix.create({
                task_id: t2.id,
                matrix_id: matrix.id,
                quadrant_index: 1,
            });

            const res = await agent.get('/api/matrices/placements');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]).toHaveProperty('task_id');
            expect(res.body.data[0]).toHaveProperty('matrix_id');
            expect(res.body.data[0]).toHaveProperty('quadrant_index');
            expect(res.body.data[0]).toHaveProperty('matrix_name');
        });

        it('should not include other users\' placements', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const otherMatrix = await Matrix.create({
                name: 'Private',
                user_id: otherUser.id,
            });
            const otherTask = await Task.create({
                name: 'Secret',
                user_id: otherUser.id,
            });
            await TaskMatrix.create({
                task_id: otherTask.id,
                matrix_id: otherMatrix.id,
                quadrant_index: 2,
            });

            const res = await agent.get('/api/matrices/placements');

            expect(res.body.data).toHaveLength(0);
        });
    });

    // ----------------------------------------------------------------
    // GET /api/matrices/:matrixId/browse — Browse available tasks
    // ----------------------------------------------------------------
    describe('GET /api/matrices/:matrixId/browse', () => {
        let matrix;

        beforeEach(async () => {
            matrix = await Matrix.create({
                name: 'Browse Test',
                user_id: user.id,
            });
        });

        it('should return tasks filtered by project', async () => {
            const project = await Project.create({
                name: 'Proj',
                user_id: user.id,
            });
            await Task.create({
                name: 'Project Task',
                user_id: user.id,
                project_id: project.id,
            });
            await Task.create({
                name: 'Other Task',
                user_id: user.id,
            });

            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse?source=project&sourceId=${project.id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Project Task');
        });

        it('should exclude tasks already in the matrix', async () => {
            const project = await Project.create({
                name: 'P',
                user_id: user.id,
            });
            const assigned = await Task.create({
                name: 'Already Placed',
                user_id: user.id,
                project_id: project.id,
            });
            await Task.create({
                name: 'Available',
                user_id: user.id,
                project_id: project.id,
            });
            await TaskMatrix.create({
                task_id: assigned.id,
                matrix_id: matrix.id,
                quadrant_index: 0,
            });

            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse?source=project&sourceId=${project.id}`
            );

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Available');
        });

        it('should return tasks filtered by area', async () => {
            const area = await Area.create({
                name: 'Work',
                user_id: user.id,
            });
            const project = await Project.create({
                name: 'Work Proj',
                user_id: user.id,
                area_id: area.id,
            });
            await Task.create({
                name: 'Area Task',
                user_id: user.id,
                project_id: project.id,
            });

            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse?source=area&sourceId=${area.id}`
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Area Task');
        });

        it('should return tasks filtered by tag', async () => {
            const tag = await Tag.create({
                name: 'urgent',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'Tagged Task',
                user_id: user.id,
            });
            await task.addTag(tag);

            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse?source=tag&sourceId=${tag.uid}`
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Tagged Task');
        });

        it('should reject missing source/sourceId', async () => {
            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse`
            );

            expect(res.status).toBe(400);
        });

        it('should reject invalid source', async () => {
            const res = await agent.get(
                `/api/matrices/${matrix.id}/browse?source=invalid&sourceId=1`
            );

            expect(res.status).toBe(400);
        });

        it('should return 404 for non-existent matrix', async () => {
            const res = await agent.get(
                '/api/matrices/99999/browse?source=project&sourceId=1'
            );

            expect(res.status).toBe(404);
        });
    });
});
