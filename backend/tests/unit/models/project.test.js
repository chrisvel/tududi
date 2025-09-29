const { Project, User, Area } = require('../../../models');

describe('Project Model', () => {
    let user, area;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        area = await Area.create({
            name: 'Work',
            user_id: user.id,
        });
    });

    describe('validation', () => {
        it('should create a project with valid data', async () => {
            const projectData = {
                name: 'Test Project',
                description: 'Test Description',
                state: 'planned',
                pin_to_sidebar: false,
                priority: 1,
                user_id: user.id,
                area_id: area.id,
            };

            const project = await Project.create(projectData);

            expect(project.name).toBe(projectData.name);
            expect(project.description).toBe(projectData.description);
            expect(project.state).toBe(projectData.state);
            expect(project.pin_to_sidebar).toBe(projectData.pin_to_sidebar);
            expect(project.priority).toBe(projectData.priority);
            expect(project.user_id).toBe(user.id);
            expect(project.area_id).toBe(area.id);
        });

        it('should require name', async () => {
            const projectData = {
                description: 'Project without name',
                user_id: user.id,
            };

            await expect(Project.create(projectData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const projectData = {
                name: 'Test Project',
            };

            await expect(Project.create(projectData)).rejects.toThrow();
        });

        it('should validate priority range', async () => {
            const projectData = {
                name: 'Test Project',
                user_id: user.id,
                priority: 5,
            };

            await expect(Project.create(projectData)).rejects.toThrow();
        });

        it('should allow valid priority values', async () => {
            for (let priority of [0, 1, 2]) {
                const project = await Project.create({
                    name: `Test Project ${priority}`,
                    user_id: user.id,
                    priority: priority,
                });
                expect(project.priority).toBe(priority);
            }
        });
    });

    describe('default values', () => {
        it('should set correct default values', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
            });

            expect(project.state).toBe('idea');
            expect(project.pin_to_sidebar).toBe(false);
            expect(project.task_show_completed).toBe(false);
            expect(project.task_sort_order).toBe('created_at:desc');
        });
    });

    describe('optional fields', () => {
        it('should allow optional fields to be null', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                description: null,
                priority: null,
                due_date_at: null,
                area_id: null,
            });

            expect(project.description).toBeNull();
            expect(project.priority).toBeNull();
            expect(project.due_date_at).toBeNull();
            expect(project.area_id).toBeNull();
        });
    });

    describe('task sorting columns', () => {
        it('should create project with task_show_completed set to true', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                task_show_completed: true,
            });

            expect(project.task_show_completed).toBe(true);
        });

        it('should create project with custom task_sort_order', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                task_sort_order: 'priority:asc',
            });

            expect(project.task_sort_order).toBe('priority:asc');
        });

        it('should allow task_show_completed to be null', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                task_show_completed: null,
            });

            expect(project.task_show_completed).toBeNull();
        });

        it('should allow task_sort_order to be null', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                task_sort_order: null,
            });

            expect(project.task_sort_order).toBeNull();
        });
    });

    describe('associations', () => {
        it('should belong to a user', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
            });

            const projectWithUser = await Project.findByPk(project.id, {
                include: [{ model: User }],
            });

            expect(projectWithUser.User).toBeDefined();
            expect(projectWithUser.User.id).toBe(user.id);
        });

        it('should belong to an area', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: user.id,
                area_id: area.id,
            });

            const projectWithArea = await Project.findByPk(project.id, {
                include: [{ model: Area }],
            });

            expect(projectWithArea.Area).toBeDefined();
            expect(projectWithArea.Area.id).toBe(area.id);
        });
    });
});
