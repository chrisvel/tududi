const request = require('supertest');
const app = require('../../app');
const { Task, Person, Project } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
};

// Overdue uids from both places the Today page reads them: the list the
// page renders and the metrics behind its counts.
const overdueUids = async (agent) => {
    const today = await agent.get('/api/tasks?type=today&include_lists=true');
    expect(today.status).toBe(200);
    const metrics = await agent.get('/api/tasks/metrics');
    expect(metrics.status).toBe(200);
    const fromList = today.body.tasks_overdue.map((t) => t.uid).sort();
    const fromMetrics = metrics.body.tasks_overdue.map((t) => t.uid).sort();
    expect(fromList).toEqual(fromMetrics);
    return fromList;
};

describe('Today counts a task assigned to someone else for the assignee only', () => {
    let manager, worker, managerAgent, workerAgent;
    let managerPerson, workerPerson, project;

    beforeEach(async () => {
        // Sequential: the first user created becomes admin.
        manager = await createTestUser({
            email: `manager_${Date.now()}@example.com`,
            name: 'Manager',
        });
        worker = await createTestUser({
            email: `worker_${Date.now()}@example.com`,
            name: 'Worker',
        });
        managerPerson = await peopleService.createSelfPerson(manager);
        workerPerson = await peopleService.createSelfPerson(worker);

        managerAgent = await login(manager);
        workerAgent = await login(worker);

        const res = await managerAgent
            .post('/api/project')
            .send({ name: 'Site handover' });
        project = await Project.findOne({ where: { uid: res.body.uid } });
        await managerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: worker.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(workerAgent);
    });

    it('moves delegated overdue tasks to the assignee and keeps the rest', async () => {
        const delegated = [];
        for (let i = 1; i <= 3; i++) {
            delegated.push(
                await Task.create({
                    name: `Delegated ${i}`,
                    user_id: manager.id,
                    project_id: project.id,
                    due_date: daysAgo(i + 1),
                    assigned_to: workerPerson.uid,
                })
            );
        }
        const unassigned = await Task.create({
            name: 'Manager own work',
            user_id: manager.id,
            project_id: project.id,
            due_date: daysAgo(2),
        });
        const selfAssigned = await Task.create({
            name: 'Manager assigned to self',
            user_id: manager.id,
            project_id: project.id,
            due_date: daysAgo(2),
            assigned_to: managerPerson.uid,
        });
        const fromWorker = await Task.create({
            name: 'Worker asks manager',
            user_id: worker.id,
            project_id: project.id,
            due_date: daysAgo(3),
            assigned_to: managerPerson.uid,
        });

        const managerOverdue = await overdueUids(managerAgent);
        expect(managerOverdue).toEqual(
            [unassigned.uid, selfAssigned.uid, fromWorker.uid].sort()
        );

        const workerOverdue = await overdueUids(workerAgent);
        expect(workerOverdue).toEqual(delegated.map((t) => t.uid).sort());
    });

    it('keeps a task assigned to a contact without an account on the owner Today', async () => {
        const child = await Person.create({
            name: 'Emma',
            user_id: manager.id,
        });
        const forChild = await Task.create({
            name: 'Pack the school bag',
            user_id: manager.id,
            due_date: daysAgo(1),
            assigned_to: child.uid,
        });

        expect(await overdueUids(managerAgent)).toContain(forChild.uid);
    });

    it('leaves Upcoming to the assignee too', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const delegated = await Task.create({
            name: 'Delegated upcoming',
            user_id: manager.id,
            project_id: project.id,
            due_date: tomorrow.toISOString().split('T')[0],
            assigned_to: workerPerson.uid,
        });

        const uidsFor = async (agent) => {
            const res = await agent.get('/api/tasks?type=upcoming');
            expect(res.status).toBe(200);
            return res.body.tasks.map((t) => t.uid);
        };

        expect(await uidsFor(managerAgent)).not.toContain(delegated.uid);
        expect(await uidsFor(workerAgent)).toContain(delegated.uid);
    });
});
