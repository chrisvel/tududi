const { Task, User } = require('../../../models');

describe('Task Model', () => {
    let user;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create a task with valid data', async () => {
            const taskData = {
                name: 'Test Task',
                description: 'Test Description',
                user_id: user.id,
            };

            const task = await Task.create(taskData);

            expect(task.name).toBe(taskData.name);
            expect(task.description).toBe(taskData.description);
            expect(task.user_id).toBe(user.id);
            expect(task.today).toBe(false);
            expect(task.priority).toBe(0);
            expect(task.status).toBe(0);
            expect(task.recurrence_type).toBe('none');
        });

        it('should require name', async () => {
            const taskData = {
                user_id: user.id,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const taskData = {
                name: 'Test Task',
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should validate priority range', async () => {
            const taskData = {
                name: 'Test Task',
                user_id: user.id,
                priority: 5,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should validate status range', async () => {
            const taskData = {
                name: 'Test Task',
                user_id: user.id,
                status: 10,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });
    });

    describe('constants', () => {
        it('should have correct priority constants', () => {
            expect(Task.PRIORITY.LOW).toBe(0);
            expect(Task.PRIORITY.MEDIUM).toBe(1);
            expect(Task.PRIORITY.HIGH).toBe(2);
        });

        it('should have correct status constants', () => {
            expect(Task.STATUS.NOT_STARTED).toBe(0);
            expect(Task.STATUS.IN_PROGRESS).toBe(1);
            expect(Task.STATUS.DONE).toBe(2);
            expect(Task.STATUS.ARCHIVED).toBe(3);
            expect(Task.STATUS.WAITING).toBe(4);
        });
    });

    describe('instance methods', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
            });
        });

        it('should return correct priority name', async () => {
            task.priority = Task.PRIORITY.LOW;
            expect(Task.getPriorityName(task.priority)).toBe('low');

            task.priority = Task.PRIORITY.MEDIUM;
            expect(Task.getPriorityName(task.priority)).toBe('medium');

            task.priority = Task.PRIORITY.HIGH;
            expect(Task.getPriorityName(task.priority)).toBe('high');
        });

        it('should return correct status name', async () => {
            task.status = Task.STATUS.NOT_STARTED;
            expect(Task.getStatusName(task.status)).toBe('not_started');

            task.status = Task.STATUS.IN_PROGRESS;
            expect(Task.getStatusName(task.status)).toBe('in_progress');

            task.status = Task.STATUS.DONE;
            expect(Task.getStatusName(task.status)).toBe('done');

            task.status = Task.STATUS.ARCHIVED;
            expect(Task.getStatusName(task.status)).toBe('archived');

            task.status = Task.STATUS.WAITING;
            expect(Task.getStatusName(task.status)).toBe('waiting');
        });
    });

    describe('default values', () => {
        it('should set correct default values', async () => {
            const task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
            });

            expect(task.today).toBe(false);
            expect(task.priority).toBe(0);
            expect(task.status).toBe(0);
            expect(task.recurrence_type).toBe('none');
        });
    });

    describe('optional fields', () => {
        it('should allow optional fields to be null', async () => {
            const task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
                description: null,
                due_date: null,
                note: null,
                recurrence_interval: null,
                recurrence_end_date: null,
                last_generated_date: null,
                project_id: null,
            });

            expect(task.description).toBeNull();
            expect(task.due_date).toBeNull();
            expect(task.note).toBeNull();
            expect(task.recurrence_interval).toBeNull();
            expect(task.recurrence_end_date).toBeNull();
            expect(task.last_generated_date).toBeNull();
            expect(task.project_id).toBeNull();
        });

        it('should accept optional field values', async () => {
            const dueDate = new Date();
            const task = await Task.create({
                name: 'Test Task',
                description: 'Test Description',
                due_date: dueDate,
                today: true,
                priority: Task.PRIORITY.HIGH,
                status: Task.STATUS.IN_PROGRESS,
                note: 'Test Note',
                user_id: user.id,
            });

            expect(task.description).toBe('Test Description');
            expect(task.due_date).toEqual(dueDate);
            expect(task.today).toBe(true);
            expect(task.priority).toBe(Task.PRIORITY.HIGH);
            expect(task.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(task.note).toBe('Test Note');
        });
    });
});
