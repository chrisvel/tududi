process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'spreadsheets-test-session-secret';

const ExcelJS = require('exceljs');
const request = require('supertest');
const app = require('../../app');
const { Task, Project, Area, Tag, ImportJob } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const binary = (res, callback) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const csv = (lines) => Buffer.from(lines.join('\n'), 'utf8');

describe('Spreadsheet import and export', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `sheets_${Date.now()}_${Math.random()}@example.com`,
        });
        agent = await login(user);
    });

    const uploadCsv = async (lines, name = 'tasks.csv') => {
        const res = await agent
            .post('/api/imports')
            .attach('file', csv(lines), name);
        expect(res.status).toBe(201);
        return res.body;
    };

    const optionsFor = (job, overrides = {}) => ({
        sheet: 0,
        header_row: job.sheets[0].header_row,
        mapping: job.sheets[0].suggested_mapping,
        target: { mode: 'column' },
        hierarchy: 'auto',
        date_order: 'auto',
        ...overrides,
    });

    describe('export', () => {
        let project;

        beforeEach(async () => {
            project = await Project.create({
                name: 'Riverside Block A',
                user_id: user.id,
            });
            const parent = await Task.create({
                name: 'Foundations',
                user_id: user.id,
                project_id: project.id,
                status: Task.STATUS.IN_PROGRESS,
                priority: Task.PRIORITY.HIGH,
            });
            await Task.create({
                name: 'Pour concrete',
                user_id: user.id,
                project_id: project.id,
                parent_task_id: parent.id,
            });
            await Task.create({
                name: 'Somebody else',
                user_id: (
                    await createTestUser({
                        email: `other_${Date.now()}@example.com`,
                    })
                ).id,
            });
        });

        it('exports a project as CSV with subtasks under their parent', async () => {
            const res = await agent
                .get(`/api/export/tasks?format=csv&project_uid=${project.uid}`)
                .buffer(true)
                .parse(binary);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['content-disposition']).toContain(
                'riverside-block-a-'
            );
            const text = res.body.toString('utf8');
            expect(text.charCodeAt(0)).toBe(0xfeff);
            const lines = text.trim().split('\r\n');
            expect(lines[0]).toContain('Name');
            expect(lines[0]).toContain('Parent UID');
            expect(lines).toHaveLength(3);
            expect(lines[1]).toContain('Foundations');
            expect(lines[1]).toContain('In Progress');
            expect(lines[2]).toContain('Pour concrete');
            expect(text).not.toContain('Somebody else');
        });

        it('exports XLSX with a frozen header row', async () => {
            const res = await agent
                .get('/api/export/tasks?format=xlsx')
                .buffer(true)
                .parse(binary);
            expect(res.status).toBe(200);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(res.body);
            const sheet = workbook.worksheets[0];
            expect(sheet.getRow(1).getCell(2).value).toBe('Name');
            expect(sheet.rowCount).toBe(3);
            expect(sheet.views[0].state).toBe('frozen');
        });

        it('rejects an unknown format and projects the user cannot see', async () => {
            const bad = await agent.get('/api/export/tasks?format=pdf');
            expect(bad.status).toBe(400);
            const other = await createTestUser({
                email: `stranger_${Date.now()}@example.com`,
            });
            const hidden = await Project.create({
                name: 'Hidden',
                user_id: other.id,
            });
            const res = await agent.get(
                `/api/export/tasks?format=csv&project_uid=${hidden.uid}`
            );
            expect(res.status).toBe(404);
        });

        it('offers a template with an instructions sheet', async () => {
            const res = await agent
                .get('/api/export/template?format=xlsx')
                .buffer(true)
                .parse(binary);
            expect(res.status).toBe(200);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(res.body);
            expect(workbook.worksheets).toHaveLength(2);
        });
    });

    describe('import', () => {
        it('suggests a mapping from the headers', async () => {
            const job = await uploadCsv([
                'Task Name;Development;Deadline;Owner;Contractor',
                'Site survey;Riverside;15/11/2026;;Acme Ltd',
            ]);
            expect(job.sheets[0].headers).toEqual([
                'Task Name',
                'Development',
                'Deadline',
                'Owner',
                'Contractor',
            ]);
            expect(job.sheets[0].suggested_mapping).toEqual([
                'name',
                'project',
                'due',
                'assignee',
                'note_append',
            ]);
        });

        it('previews without writing anything', async () => {
            const job = await uploadCsv([
                'Name,Project,Parent,Status,Due,Tags',
                'Foundations,Riverside,,In progress,13/11/2026,"site, phase 1"',
                'Pour concrete,Riverside,Foundations,todo,14/11/2026,',
                ',Riverside,,,,',
                'Snagging,Riverside,,Approved,02/12/2026,',
            ]);
            const res = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job));
            expect(res.status).toBe(200);
            expect(res.body.counts).toMatchObject({
                create: 3,
                skip: 1,
                new_projects: 1,
                new_tags: 2,
            });
            expect(res.body.date_columns.due.detected).toBe('dmy');
            expect(res.body.unknown_values.status).toEqual(['Approved']);
            const child = res.body.rows.find((r) => r.name === 'Pour concrete');
            expect(child.parent).toBe('Foundations');
            expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
        });

        it('imports tasks, subtasks, projects and tags, and can undo it', async () => {
            const job = await uploadCsv([
                'Name,Project,Area,Parent,Status,Priority,Due,Estimate,Tags,Contractor',
                'Foundations,Riverside,Construction,,In progress,High,2026-11-13,,site,',
                'Pour concrete,Riverside,Construction,Foundations,Done,,2026-11-14 09:30,2h,,Acme',
                'Permits,,,,Waiting,Low,,,admin,',
            ]);
            const res = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job));
            expect(res.status).toBe(200);
            expect(res.body.counts).toMatchObject({
                created: 3,
                new_projects: 1,
                new_areas: 1,
            });

            const project = await Project.findOne({
                where: { user_id: user.id, name: 'Riverside' },
            });
            const area = await Area.findOne({
                where: { user_id: user.id, name: 'Construction' },
            });
            expect(project.area_id).toBe(area.id);

            const parent = await Task.findOne({
                where: { user_id: user.id, name: 'Foundations' },
                include: [{ model: Tag }],
            });
            const child = await Task.findOne({
                where: { user_id: user.id, name: 'Pour concrete' },
            });
            const loose = await Task.findOne({
                where: { user_id: user.id, name: 'Permits' },
            });
            expect(parent.project_id).toBe(project.id);
            expect(parent.priority).toBe(Task.PRIORITY.HIGH);
            expect(parent.Tags.map((t) => t.name)).toEqual(['site']);
            expect(child.parent_task_id).toBe(parent.id);
            expect(child.status).toBe(Task.STATUS.DONE);
            expect(child.completed_at).not.toBeNull();
            expect(child.due_has_time).toBe(true);
            expect(child.estimated_minutes).toBe(120);
            expect(child.note).toBe('Contractor: Acme');
            expect(loose.project_id).toBeNull();
            expect(loose.status).toBe(Task.STATUS.WAITING);

            const again = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job));
            expect(again.status).toBe(409);

            const history = await agent.get('/api/imports');
            expect(history.body[0]).toMatchObject({
                uid: job.uid,
                can_undo: true,
            });

            const undo = await agent.post(`/api/imports/${job.uid}/undo`);
            expect(undo.status).toBe(200);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
            expect(await Project.count({ where: { user_id: user.id } })).toBe(
                0
            );
            expect(await Area.count({ where: { user_id: user.id } })).toBe(0);

            const twice = await agent.post(`/api/imports/${job.uid}/undo`);
            expect(twice.status).toBe(409);
        });

        it('imports into a chosen project with WBS numbers as hierarchy', async () => {
            const project = await Project.create({
                name: 'Harbour View',
                user_id: user.id,
            });
            const job = await uploadCsv([
                'WBS,Activity,Start,Finish',
                '1,Groundworks,01/03/2027,30/04/2027',
                '1.1,Excavation,01/03/2027,15/03/2027',
                '1.1.1,Spoil removal,05/03/2027,10/03/2027',
                '2,Structure,01/05/2027,30/09/2027',
            ]);
            const res = await agent.post(`/api/imports/${job.uid}/commit`).send(
                optionsFor(job, {
                    target: { mode: 'project', project_uid: project.uid },
                })
            );
            expect(res.status).toBe(200);
            const tasks = await Task.findAll({
                where: { project_id: project.id },
                order: [['id', 'ASC']],
            });
            const byName = Object.fromEntries(tasks.map((t) => [t.name, t]));
            expect(tasks).toHaveLength(4);
            expect(byName.Excavation.parent_task_id).toBe(
                byName.Groundworks.id
            );
            // One level of subtasks: the third level joins its grandparent.
            expect(byName['Spoil removal'].parent_task_id).toBe(
                byName.Groundworks.id
            );
            expect(byName.Structure.parent_task_id).toBeNull();
            expect(byName.Structure.start_date).not.toBeNull();
        });

        it('updates exported tasks by uid on re-import and undoes the update', async () => {
            const project = await Project.create({
                name: 'Lot 7',
                user_id: user.id,
            });
            const task = await Task.create({
                name: 'Order windows',
                user_id: user.id,
                project_id: project.id,
                note: 'Keep me',
            });
            const exported = await agent
                .get(`/api/export/tasks?format=csv&project_uid=${project.uid}`)
                .buffer(true)
                .parse(binary);
            const lines = exported.body.toString('utf8').trim().split('\r\n');
            const header = lines[0].replace(/^﻿/, '');
            const row = lines[1].split(',');
            const statusColumn = header.split(',').indexOf('Status');
            row[statusColumn] = 'Done';
            const job = await uploadCsv(
                [header, row.join(','), 'Measure openings,Lot 7'.padStart(0)],
                'lot7.csv'
            );
            const options = optionsFor(job);
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(options);
            expect(preview.body.counts.update).toBe(1);

            const res = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(options);
            expect(res.status).toBe(200);
            await task.reload();
            expect(task.status).toBe(Task.STATUS.DONE);
            expect(task.note).toBe('Keep me');
            expect(task.completed_at).not.toBeNull();

            await agent.post(`/api/imports/${job.uid}/undo`).expect(200);
            await task.reload();
            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            expect(task.completed_at).toBeNull();
            expect(await Project.findByPk(project.id)).not.toBeNull();
        });

        it('reads Excel files, including indented rows as subtasks', async () => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Schedule');
            sheet.addRow(['Riverside schedule']);
            sheet.addRow([]);
            sheet.addRow(['Task', 'Due']);
            sheet.addRow(['Fit-out', new Date(Date.UTC(2027, 0, 20))]);
            const child = sheet.addRow([
                'Kitchens',
                new Date(Date.UTC(2027, 0, 10)),
            ]);
            child.getCell(1).alignment = { indent: 1 };
            const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

            const upload = await agent
                .post('/api/imports')
                .attach('file', buffer, 'schedule.xlsx');
            expect(upload.status).toBe(201);
            const job = upload.body;
            expect(job.sheets[0].header_row).toBe(1);
            expect(job.sheets[0].has_levels).toBe(true);

            const res = await agent.post(`/api/imports/${job.uid}/commit`).send(
                optionsFor(job, {
                    target: { mode: 'new_project', project_name: 'Fit-out' },
                })
            );
            expect(res.status).toBe(200);
            const kitchens = await Task.findOne({
                where: { user_id: user.id, name: 'Kitchens' },
            });
            const fitOut = await Task.findOne({
                where: { user_id: user.id, name: 'Fit-out' },
            });
            expect(kitchens.parent_task_id).toBe(fitOut.id);
            expect(kitchens.due_date).not.toBeNull();
        });

        it('keeps imports private to their owner', async () => {
            const job = await uploadCsv(['Name', 'Mine']);
            const other = await createTestUser({
                email: `peeker_${Date.now()}@example.com`,
            });
            const otherAgent = await login(other);
            const res = await otherAgent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job));
            expect(res.status).toBe(404);
        });

        it('rejects files it cannot read', async () => {
            const pdf = await agent
                .post('/api/imports')
                .attach('file', Buffer.from('%PDF'), 'plan.pdf');
            expect(pdf.status).toBe(400);
            const xls = await agent
                .post('/api/imports')
                .attach(
                    'file',
                    Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
                    'old.xls'
                );
            expect(xls.status).toBe(400);
            expect(xls.body.error).toContain('.xlsx');
            expect(xls.body.reason).toBe('old_xls');
            expect(pdf.body.reason).toBe('wrong_type');
        });

        it('cleans up the staged file once committed', async () => {
            const job = await uploadCsv(['Name', 'One']);
            await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job, { target: { mode: 'none' } }))
                .expect(200);
            const stored = await ImportJob.findOne({ where: { uid: job.uid } });
            expect(stored.sheets).toBeNull();
            expect(stored.result.created_task_ids).toHaveLength(1);
        });
    });
});
