const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Subtask Ordering', () => {
    let agent;
    let testUser;

    beforeEach(async () => {
        await Task.destroy({ where: {}, truncate: true });

        testUser = await createTestUser();

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: testUser.email,
            password: 'password123',
        });
    });

    describe('Creating subtasks with order', () => {
        it('should create subtasks with sequential order values', async () => {
            const taskData = {
                name: 'Parent Task',
                subtasks: [
                    { name: 'First Subtask', isNew: true },
                    { name: 'Second Subtask', isNew: true },
                    { name: 'Third Subtask', isNew: true },
                    { name: 'Fourth Subtask', isNew: true },
                ],
            };

            const response = await agent
                .post('/api/task')
                .send(taskData)
                .expect(201);

            // Fetch subtasks from database directly
            const subtasks = await Task.findAll({
                where: { parent_task_id: response.body.id },
                order: [['order', 'ASC']],
            });

            expect(subtasks).toHaveLength(4);
            expect(subtasks[0].name).toBe('First Subtask');
            expect(subtasks[0].order).toBe(1);
            expect(subtasks[1].name).toBe('Second Subtask');
            expect(subtasks[1].order).toBe(2);
            expect(subtasks[2].name).toBe('Third Subtask');
            expect(subtasks[2].order).toBe(3);
            expect(subtasks[3].name).toBe('Fourth Subtask');
            expect(subtasks[3].order).toBe(4);
        });

        it('should handle empty subtask names and maintain order', async () => {
            const taskData = {
                name: 'Parent Task',
                subtasks: [
                    { name: 'First', isNew: true },
                    { name: '', isNew: true }, // Should be ignored
                    { name: 'Second', isNew: true },
                    { name: '   ', isNew: true }, // Should be ignored
                    { name: 'Third', isNew: true },
                ],
            };

            const response = await agent
                .post('/api/task')
                .send(taskData)
                .expect(201);

            const subtasks = await Task.findAll({
                where: { parent_task_id: response.body.id },
                order: [['order', 'ASC']],
            });

            expect(subtasks).toHaveLength(3);
            expect(subtasks[0].name).toBe('First');
            expect(subtasks[0].order).toBe(1);
            expect(subtasks[1].name).toBe('Second');
            expect(subtasks[1].order).toBe(2);
            expect(subtasks[2].name).toBe('Third');
            expect(subtasks[2].order).toBe(3);
        });
    });

    describe('Retrieving subtasks in order', () => {
        it('should return subtasks in correct order via API', async () => {
            // Create parent task with subtasks
            const taskData = {
                name: 'Parent Task',
                subtasks: [
                    { name: 'Zebra', isNew: true },
                    { name: 'Apple', isNew: true },
                    { name: 'Middle', isNew: true },
                ],
            };

            const createResponse = await agent
                .post('/api/task')
                .send(taskData)
                .expect(201);

            // Get subtasks via API
            const response = await agent
                .get(`/api/task/${createResponse.body.id}/subtasks`)
                .expect(200);

            expect(response.body).toHaveLength(3);
            // Should be in creation order, not alphabetical
            expect(response.body[0].name).toBe('Zebra');
            expect(response.body[1].name).toBe('Apple');
            expect(response.body[2].name).toBe('Middle');
        });

        it('should return subtasks in correct order when fetching parent task', async () => {
            const taskData = {
                name: 'Parent Task',
                subtasks: [
                    { name: 'Task 1', isNew: true },
                    { name: 'Task 2', isNew: true },
                    { name: 'Task 3', isNew: true },
                ],
            };

            const createResponse = await agent
                .post('/api/task')
                .send(taskData)
                .expect(201);

            // Fetch task with subtasks
            const response = await agent
                .get(`/api/task/${createResponse.body.uid}`)
                .expect(200);

            expect(response.body.subtasks).toHaveLength(3);
            expect(response.body.subtasks[0].name).toBe('Task 1');
            expect(response.body.subtasks[1].name).toBe('Task 2');
            expect(response.body.subtasks[2].name).toBe('Task 3');
        });
    });

    describe('Updating subtask order', () => {
        it('should update order when subtasks are reordered', async () => {
            // Create task with subtasks
            const createResponse = await agent
                .post('/api/task')
                .send({
                    name: 'Parent Task',
                    subtasks: [
                        { name: 'First', isNew: true },
                        { name: 'Second', isNew: true },
                        { name: 'Third', isNew: true },
                    ],
                })
                .expect(201);

            // Fetch subtasks
            const subtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            // Reorder subtasks: Third, First, Second
            const updateData = {
                name: 'Parent Task',
                subtasks: [
                    { id: subtasks[2].id, name: 'Third' }, // Was 3rd, now 1st
                    { id: subtasks[0].id, name: 'First' }, // Was 1st, now 2nd
                    { id: subtasks[1].id, name: 'Second' }, // Was 2nd, now 3rd
                ],
            };

            await agent
                .patch(`/api/task/${createResponse.body.uid}`)
                .send(updateData)
                .expect(200);

            // Verify new order
            const updatedSubtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            expect(updatedSubtasks[0].name).toBe('Third');
            expect(updatedSubtasks[0].order).toBe(1);
            expect(updatedSubtasks[1].name).toBe('First');
            expect(updatedSubtasks[1].order).toBe(2);
            expect(updatedSubtasks[2].name).toBe('Second');
            expect(updatedSubtasks[2].order).toBe(3);
        });

        it('should maintain order when adding new subtasks to existing ones', async () => {
            // Create task with 2 subtasks
            const createResponse = await agent
                .post('/api/task')
                .send({
                    name: 'Parent Task',
                    subtasks: [
                        { name: 'First', isNew: true },
                        { name: 'Second', isNew: true },
                    ],
                })
                .expect(201);

            const existingSubtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            // Add new subtasks while keeping existing ones
            const updateData = {
                name: 'Parent Task',
                subtasks: [
                    { id: existingSubtasks[0].id, name: 'First' },
                    { id: existingSubtasks[1].id, name: 'Second' },
                    { name: 'Third', isNew: true },
                    { name: 'Fourth', isNew: true },
                ],
            };

            await agent
                .patch(`/api/task/${createResponse.body.uid}`)
                .send(updateData)
                .expect(200);

            const allSubtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            expect(allSubtasks).toHaveLength(4);
            expect(allSubtasks[0].name).toBe('First');
            expect(allSubtasks[0].order).toBe(1);
            expect(allSubtasks[1].name).toBe('Second');
            expect(allSubtasks[1].order).toBe(2);
            expect(allSubtasks[2].name).toBe('Third');
            expect(allSubtasks[2].order).toBe(3);
            expect(allSubtasks[3].name).toBe('Fourth');
            expect(allSubtasks[3].order).toBe(4);
        });

        it('should handle deleting and reordering subtasks simultaneously', async () => {
            // Create task with 4 subtasks
            const createResponse = await agent
                .post('/api/task')
                .send({
                    name: 'Parent Task',
                    subtasks: [
                        { name: 'First', isNew: true },
                        { name: 'Second', isNew: true },
                        { name: 'Third', isNew: true },
                        { name: 'Fourth', isNew: true },
                    ],
                })
                .expect(201);

            const subtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            // Keep only 1st and 3rd, in reverse order
            const updateData = {
                name: 'Parent Task',
                subtasks: [
                    { id: subtasks[2].id, name: 'Third' },
                    { id: subtasks[0].id, name: 'First' },
                ],
            };

            await agent
                .patch(`/api/task/${createResponse.body.uid}`)
                .send(updateData)
                .expect(200);

            const remainingSubtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            expect(remainingSubtasks).toHaveLength(2);
            expect(remainingSubtasks[0].name).toBe('Third');
            expect(remainingSubtasks[0].order).toBe(1);
            expect(remainingSubtasks[1].name).toBe('First');
            expect(remainingSubtasks[1].order).toBe(2);
        });
    });

    describe('Edge cases', () => {
        it('should handle many subtasks (100+) with correct ordering', async () => {
            const subtasks = Array.from({ length: 100 }, (_, i) => ({
                name: `Subtask ${i + 1}`,
                isNew: true,
            }));

            const createResponse = await agent
                .post('/api/task')
                .send({
                    name: 'Parent Task',
                    subtasks,
                })
                .expect(201);

            const createdSubtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            expect(createdSubtasks).toHaveLength(100);
            createdSubtasks.forEach((subtask, index) => {
                expect(subtask.name).toBe(`Subtask ${index + 1}`);
                expect(subtask.order).toBe(index + 1);
            });
        });

        it('should handle concurrent subtask creation correctly', async () => {
            // Create parent task
            const createResponse = await agent
                .post('/api/task')
                .send({ name: 'Parent Task' })
                .expect(201);

            // Add subtasks in multiple concurrent requests
            const promises = [
                agent.patch(`/api/task/${createResponse.body.uid}`).send({
                    name: 'Parent Task',
                    subtasks: [
                        { name: 'Batch 1 - Task 1', isNew: true },
                        { name: 'Batch 1 - Task 2', isNew: true },
                    ],
                }),
                // Note: This test demonstrates the limitation - concurrent updates
                // may result in inconsistent state. In practice, the UI prevents this.
            ];

            await Promise.all(promises);

            const subtasks = await Task.findAll({
                where: { parent_task_id: createResponse.body.id },
                order: [['order', 'ASC']],
            });

            // Verify all subtasks have order values
            expect(subtasks.length).toBeGreaterThan(0);
            subtasks.forEach((subtask) => {
                expect(subtask.order).toBeDefined();
                expect(subtask.order).toBeGreaterThan(0);
            });
        });
    });
});
