const app = require('../../app');
const { sequelize, User, Project, Tag, Task } = require('../../models');
const bcrypt = require('bcrypt');
const { report } = require('../helpers/caldav-test-utils');

const ENC = encodeURIComponent;

// Regression guard: the VTODO serializer only emits CATEGORIES /
// X-TUDUDI-TAG-UIDS / RELATED-TO when the corresponding associations are eager
// loaded. When the CalDAV queries dropped the `include`, those properties were
// silently omitted for every task and no client ever saw tags or parent links.
describe('CalDAV task associations reach the client', () => {
    let testUser;
    let authHeader;

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        testUser = await User.create({
            email: 'associations-caldav@test.com',
            password_digest: hashedPassword,
            verified: true,
        });

        authHeader =
            'Basic ' +
            Buffer.from('associations-caldav@test.com:password123').toString(
                'base64'
            );
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const tasksUrl = () => `/caldav/${ENC(testUser.email)}/tasks/`;

    const REPORT_XML = `<?xml version="1.0"?>
        <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
          <D:prop><C:calendar-data/></D:prop>
          <C:filter>
            <C:comp-filter name="VCALENDAR">
              <C:comp-filter name="VTODO"/>
            </C:comp-filter>
          </C:filter>
        </C:calendar-query>`;

    const queryAll = () =>
        report(app, tasksUrl())
            .set('Authorization', authHeader)
            .set('Content-Type', 'application/xml')
            .send(REPORT_XML);

    it('exposes tags as CATEGORIES', async () => {
        const task = await Task.create({
            uid: 'assoc-task-tagged',
            user_id: testUser.id,
            name: 'Tagged task',
        });
        const tag = await Tag.create({
            uid: 'assoc-tag-1',
            user_id: testUser.id,
            name: 'errands',
        });
        await task.addTag(tag);

        const res = await queryAll();

        expect(res.status).toBe(207);
        expect(res.text).toContain('CATEGORIES:errands');
        expect(res.text).toContain('X-TUDUDI-TAG-UIDS:assoc-tag-1');
    });

    it('exposes the parent task as RELATED-TO', async () => {
        const parent = await Task.create({
            uid: 'assoc-task-parent',
            user_id: testUser.id,
            name: 'Parent task',
        });
        await Task.create({
            uid: 'assoc-task-child',
            user_id: testUser.id,
            name: 'Child task',
            parent_task_id: parent.id,
        });

        const res = await queryAll();

        expect(res.status).toBe(207);
        expect(res.text).toContain('RELATED-TO');
        expect(res.text).toContain('assoc-task-parent');
    });

    it('exposes the project as X-TUDUDI-PROJECT-UID', async () => {
        const project = await Project.create({
            uid: 'assoc-project-1',
            user_id: testUser.id,
            name: 'Some project',
        });
        await Task.create({
            uid: 'assoc-task-in-project',
            user_id: testUser.id,
            name: 'Task in a project',
            project_id: project.id,
        });

        const res = await queryAll();

        expect(res.status).toBe(207);
        expect(res.text).toContain('X-TUDUDI-PROJECT-UID:assoc-project-1');
    });
});
