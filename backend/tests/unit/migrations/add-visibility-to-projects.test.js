const { Sequelize } = require('sequelize');
const {
    sequelize,
    User,
    Area,
    Task,
    Project,
    Permission,
    Notification,
} = require('../../../models');
const migration = require('../../../migrations/20261027120000-add-visibility-to-projects');

describe('migration 20261027120000-add-visibility-to-projects', () => {
    const run = () => migration.up(sequelize.getQueryInterface(), Sequelize);

    let owner, member, sharedArea, privateArea;

    beforeEach(async () => {
        owner = await User.create({
            email: 'owner@example.com',
            name: 'Owner',
        });
        member = await User.create({
            email: 'member@example.com',
            name: 'Member',
        });
        sharedArea = await Area.create({ name: 'Clients', user_id: owner.id });
        privateArea = await Area.create({ name: 'Home', user_id: owner.id });
        await Permission.create({
            user_id: member.id,
            resource_type: 'area',
            resource_uid: sharedArea.uid,
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('moves loose tasks in a shared area into a private project per owner', async () => {
        const ownerTask = await Task.create({
            name: 'Call the accountant',
            user_id: owner.id,
            area_id: sharedArea.id,
        });
        const memberTask = await Task.create({
            name: 'Send invoice',
            user_id: member.id,
            area_id: sharedArea.id,
        });

        await run();

        const ownerMoved = await Task.findByPk(ownerTask.id);
        const memberMoved = await Task.findByPk(memberTask.id);
        expect(ownerMoved.area_id).toBeNull();
        expect(memberMoved.area_id).toBeNull();

        const ownerProject = await Project.findByPk(ownerMoved.project_id);
        const memberProject = await Project.findByPk(memberMoved.project_id);
        expect(ownerProject.name).toBe('Moved from Clients');
        expect(ownerProject.user_id).toBe(owner.id);
        expect(ownerProject.area_id).toBeNull();
        expect(memberProject.user_id).toBe(member.id);
        expect(memberProject.id).not.toBe(ownerProject.id);
    });

    it('tells the area owner how many tasks moved', async () => {
        await Task.create({
            name: 'One',
            user_id: owner.id,
            area_id: sharedArea.id,
        });
        await Task.create({
            name: 'Two',
            user_id: owner.id,
            area_id: sharedArea.id,
        });

        await run();

        const notes = await Notification.findAll({
            where: { user_id: owner.id, type: 'system' },
        });
        expect(notes).toHaveLength(1);
        expect(notes[0].title).toBe('Tasks moved out of Clients');
        expect(notes[0].message).toContain('2 tasks were');
    });

    it('leaves tasks in projects and in unshared areas alone', async () => {
        const project = await Project.create({
            name: 'Acme',
            user_id: owner.id,
            area_id: sharedArea.id,
        });
        const inProject = await Task.create({
            name: 'In a project',
            user_id: owner.id,
            area_id: sharedArea.id,
            project_id: project.id,
        });
        const inPrivateArea = await Task.create({
            name: 'At home',
            user_id: owner.id,
            area_id: privateArea.id,
        });

        await run();

        expect((await Task.findByPk(inProject.id)).project_id).toBe(project.id);
        const home = await Task.findByPk(inPrivateArea.id);
        expect(home.area_id).toBe(privateArea.id);
        expect(home.project_id).toBeNull();
        expect(await Notification.count({ where: { user_id: owner.id } })).toBe(
            0
        );
    });
});
