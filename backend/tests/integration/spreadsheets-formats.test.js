process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'spreadsheets-formats-session-secret';

const zlib = require('zlib');
const ExcelJS = require('exceljs');
const iconv = require('iconv-lite');
const request = require('supertest');
const app = require('../../app');
const { Task, Project, Area, Tag, Person, User } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

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

const xlsx = async (build) => {
    const workbook = new ExcelJS.Workbook();
    await build(workbook);
    return Buffer.from(await workbook.xlsx.writeBuffer());
};

// A minimal zip with one deflated entry, for archives ExcelJS would never
// write: a small file that inflates to far more than it claims.
const zipWith = (name, content) => {
    const data = zlib.deflateRawSync(content, { level: 9 });
    const nameBuffer = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(100, 22); // claims 100 bytes
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(100, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    const localPart = Buffer.concat([local, nameBuffer, data]);
    const centralPart = Buffer.concat([central, nameBuffer]);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(centralPart.length, 12);
    end.writeUInt32LE(localPart.length, 16);
    return Buffer.concat([localPart, centralPart, end]);
};

describe('Spreadsheet import: real-world files and abuse', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `fmt_${Date.now()}_${Math.random()}@example.com`,
        });
        agent = await login(user);
    });

    const upload = async (buffer, name, fields = {}) => {
        let req = agent.post('/api/imports');
        for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
        return req.attach('file', buffer, name);
    };

    const uploadOk = async (buffer, name, fields) => {
        const res = await upload(buffer, name, fields);
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

    const commit = async (job, overrides) => {
        const res = await agent
            .post(`/api/imports/${job.uid}/commit`)
            .send(optionsFor(job, overrides));
        expect(res.status).toBe(200);
        return res.body;
    };

    const mine = (where = {}) =>
        Task.findAll({
            where: { user_id: user.id, ...where },
            include: [{ model: Tag }],
            order: [['id', 'ASC']],
        });

    const byName = async () =>
        Object.fromEntries((await mine()).map((t) => [t.name, t]));

    describe('exports from other tools', () => {
        it('reads an Asana CSV export', async () => {
            const job = await uploadOk(
                Buffer.from(
                    [
                        'Task ID,Created At,Completed At,Last Modified,Name,Section/Column,Assignee,Assignee Email,Start Date,Due Date,Tags,Notes,Projects,Parent task,Blocked By (Dependencies)',
                        '1205,2026-10-01,,2026-10-02,Tender documents,Design,,,2026-11-01,2026-11-15,"legal,tender",Draft first,Riverside Block A,,',
                        '1206,2026-10-01,2026-10-20,2026-10-20,Engineer sign-off,Design,,,,2026-10-20,,,"Riverside Block A",Tender documents,1205',
                    ].join('\n')
                ),
                'asana.csv'
            );
            const mapping = job.sheets[0].suggested_mapping;
            const headers = job.sheets[0].headers;
            const target = (h) => mapping[headers.indexOf(h)];
            expect(target('Task ID')).toBe('ignore');
            expect(target('Name')).toBe('name');
            expect(target('Projects')).toBe('project');
            expect(target('Parent task')).toBe('parent');
            expect(target('Completed At')).toBe('completed_at');
            expect(target('Assignee Email')).toBe('ignore');
            expect(target('Section/Column')).toBe('note_append');

            await commit(job);
            const tasks = await byName();
            const project = await Project.findOne({
                where: { user_id: user.id, name: 'Riverside Block A' },
            });
            expect(tasks['Tender documents'].project_id).toBe(project.id);
            expect(
                tasks['Tender documents'].Tags.map((t) => t.name).sort()
            ).toEqual(['legal', 'tender']);
            expect(tasks['Engineer sign-off'].parent_task_id).toBe(
                tasks['Tender documents'].id
            );
            expect(tasks['Tender documents'].note).toContain('Draft first');
            expect(tasks['Tender documents'].note).toContain(
                'Section/Column: Design'
            );
        });

        it('reads a ClickUp CSV export with US dates and times', async () => {
            const job = await uploadOk(
                Buffer.from(
                    [
                        'Task ID,Task Name,Task Content,Status,Date Created,Due Date,Start Date,Assignees,Priority,Tags,List Name,Folder Name',
                        'abc1,Site visit,Bring hard hats,in progress,10/01/2026,11/13/2026 5:00:00 PM,11/10/2026,[],urgent,[site],Lot 7,Construction',
                        'abc2,Snag list,,complete,10/01/2026,11/30/2026,,[],normal,,Lot 7,Construction',
                    ].join('\n')
                ),
                'clickup.csv'
            );
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job));
            expect(preview.body.date_columns.due.detected).toBe('mdy');
            await commit(job);
            const tasks = await byName();
            const visit = tasks['Site visit'];
            expect(visit.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(visit.priority).toBe(Task.PRIORITY.HIGH);
            expect(visit.due_has_time).toBe(true);
            expect(visit.note).toContain('Bring hard hats');
            expect(tasks['Snag list'].status).toBe(Task.STATUS.DONE);
            const project = await Project.findByPk(visit.project_id, {
                include: [{ model: Area }],
            });
            expect(project.name).toBe('Lot 7');
            expect(project.Area.name).toBe('Construction');
        });

        it('reads a board export that repeats the header for every group', async () => {
            const buffer = await xlsx(async (wb) => {
                const sheet = wb.addWorksheet('Board');
                sheet.addRow(['Riverside handover']);
                sheet.addRow([]);
                sheet.addRow(['Snagging']);
                sheet.addRow(['Name', 'Person', 'Status', 'Date']);
                sheet.addRow(['Fix door', '', 'Working on it', '2026-11-20']);
                sheet.addRow([]);
                sheet.addRow(['Paperwork']);
                sheet.addRow(['Name', 'Person', 'Status', 'Date']);
                sheet.addRow(['Sign deed', '', 'Done', '2026-11-25']);
            });
            const job = await uploadOk(buffer, 'monday.xlsx');
            expect(job.sheets[0].headers).toEqual([
                'Name',
                'Person',
                'Status',
                'Date',
            ]);
            await commit(job, { target: { mode: 'none' } });
            const names = (await mine()).map((t) => t.name);
            expect(names).toEqual(['Fix door', 'Paperwork', 'Sign deed']);
            const tasks = await byName();
            expect(tasks['Fix door'].status).toBe(Task.STATUS.IN_PROGRESS);
            expect(tasks['Sign deed'].status).toBe(Task.STATUS.DONE);
        });

        it('reads a Notion CSV with written-out dates', async () => {
            const job = await uploadOk(
                Buffer.from(
                    '﻿Name,Status,Due,Tags\nOrder tiles,Not started,"November 13, 2026",kitchen\nBook electrician,Done,"December 1, 2026 2:30 PM",\n'
                ),
                'notion.csv'
            );
            await commit(job, { target: { mode: 'none' } });
            const tasks = await byName();
            expect(tasks['Order tiles'].due_date).not.toBeNull();
            expect(tasks['Book electrician'].due_has_time).toBe(true);
            expect(tasks['Book electrician'].status).toBe(Task.STATUS.DONE);
        });

        it('reads a scheduling sheet with outline levels and WBS numbers', async () => {
            const buffer = await xlsx(async (wb) => {
                const sheet = wb.addWorksheet('Schedule');
                sheet.addRow([
                    'ID',
                    'WBS',
                    'Task Name',
                    'Duration',
                    'Start',
                    'Finish',
                ]);
                const rows = [
                    [
                        1,
                        '1',
                        'Pre-construction',
                        '20 days',
                        '2027-01-04',
                        '2027-01-29',
                    ],
                    [
                        2,
                        '1.1',
                        'Permits',
                        '10 days',
                        '2027-01-04',
                        '2027-01-15',
                    ],
                    [3, '1.2', 'Surveys', '5 days', '2027-01-18', '2027-01-22'],
                    [
                        4,
                        '2',
                        'Construction',
                        '120 days',
                        '2027-02-01',
                        '2027-07-16',
                    ],
                    [
                        5,
                        '2.1',
                        'Foundations',
                        '15 days',
                        '2027-02-01',
                        '2027-02-19',
                    ],
                    [
                        6,
                        '2.1.1',
                        'Excavation',
                        '5 days',
                        '2027-02-01',
                        '2027-02-05',
                    ],
                ];
                for (const values of rows) {
                    const row = sheet.addRow(values);
                    row.outlineLevel = values[1].split('.').length - 1;
                }
            });
            const job = await uploadOk(buffer, 'msproject.xlsx');
            const headers = job.sheets[0].headers;
            const mapping = job.sheets[0].suggested_mapping;
            expect(mapping[headers.indexOf('WBS')]).toBe('wbs');
            expect(mapping[headers.indexOf('Finish')]).toBe('due');
            // "Duration" in days is no task estimate; it is not taken as one
            // silently either: out-of-range values warn and are left out.
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(
                    optionsFor(job, {
                        target: {
                            mode: 'new_project',
                            project_name: 'Harbour',
                        },
                    })
                );
            expect(preview.body.hierarchy_used).toBe('wbs');
            await commit(job, {
                target: { mode: 'new_project', project_name: 'Harbour' },
            });
            const tasks = await byName();
            expect(tasks.Permits.parent_task_id).toBe(
                tasks['Pre-construction'].id
            );
            expect(tasks.Excavation.parent_task_id).toBe(tasks.Construction.id);
            expect(tasks.Construction.parent_task_id).toBeNull();
        });

        it('takes outline levels as subtasks when there is no WBS column', async () => {
            const buffer = await xlsx(async (wb) => {
                const sheet = wb.addWorksheet('Plan');
                sheet.addRow(['Task', 'Owner']);
                sheet.addRow(['Phase 1']);
                const a = sheet.addRow(['Clear site']);
                a.outlineLevel = 1;
                const b = sheet.addRow(['Fence site']);
                b.outlineLevel = 1;
                sheet.addRow(['Phase 2']);
            });
            const job = await uploadOk(buffer, 'smartsheet.xlsx');
            expect(job.sheets[0].has_levels).toBe(true);
            await commit(job, { target: { mode: 'none' } });
            const tasks = await byName();
            expect(tasks['Clear site'].parent_task_id).toBe(
                tasks['Phase 1'].id
            );
            expect(tasks['Fence site'].parent_task_id).toBe(
                tasks['Phase 1'].id
            );
            expect(tasks['Phase 2'].parent_task_id).toBeNull();
        });
    });

    describe('hand-made sheets', () => {
        it('copes with title rows, formulas, booleans, links, rich text and hidden sheets', async () => {
            const buffer = await xlsx(async (wb) => {
                const hidden = wb.addWorksheet('Lookup');
                hidden.state = 'hidden';
                hidden.addRow(['secret', 'values']);
                const sheet = wb.addWorksheet('Tasks');
                sheet.mergeCells('A1:D1');
                sheet.getCell('A1').value = 'Riverside snag list';
                sheet.addRow([]);
                sheet.addRow(['Item', 'Done', 'Hours', 'Link']);
                sheet.addRow([
                    {
                        richText: [
                            { text: 'Fix ' },
                            { text: 'door', font: { bold: true } },
                        ],
                    },
                    true,
                    { formula: 'A1*0+1.5', result: 1.5 },
                    { text: 'photo', hyperlink: 'https://example.com/p.jpg' },
                ]);
                sheet.addRow(['Paint hall', false, 3, '']);
                const extra = wb.addWorksheet('Empty');
                extra.addRow([]);
            });
            const job = await uploadOk(buffer, 'handmade.xlsx');
            expect(job.sheets.map((s) => s.name)).toEqual(['Tasks']);
            expect(job.sheets[0].header_row).toBe(1);
            expect(job.sheets[0].headers).toEqual([
                'Item',
                'Done',
                'Hours',
                'Link',
            ]);
            const mapping = job.sheets[0].suggested_mapping;
            expect(mapping).toEqual([
                'name',
                'status',
                'note_append',
                'note_append',
            ]);
            await commit(job, { target: { mode: 'none' } });
            const tasks = await byName();
            expect(tasks['Fix door'].status).toBe(Task.STATUS.DONE);
            expect(tasks['Fix door'].note).toContain('Hours: 1.5');
            expect(tasks['Fix door'].note).toContain('Link: photo');
            expect(tasks['Paint hall'].status).toBe(Task.STATUS.NOT_STARTED);
        });

        it('lets the user choose another sheet and header row', async () => {
            const buffer = await xlsx(async (wb) => {
                wb.addWorksheet('Summary').addRow(['Total', 3]);
                const sheet = wb.addWorksheet('Detail');
                sheet.addRow(['Report', 'October']);
                sheet.addRow(['Name', 'Due']);
                sheet.addRow(['One', '2026-12-01']);
            });
            const job = await uploadOk(buffer, 'two.xlsx');
            expect(job.sheets).toHaveLength(2);
            const columns = await agent
                .post(`/api/imports/${job.uid}/columns`)
                .send({ sheet: 1, header_row: 1 });
            expect(columns.body.headers).toEqual(['Name', 'Due']);
            await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send({
                    sheet: 1,
                    header_row: 1,
                    mapping: columns.body.suggested_mapping,
                    target: { mode: 'none' },
                })
                .expect(200);
            const tasks = await mine();
            expect(tasks.map((t) => t.name)).toEqual(['One']);
        });

        it('reads Excel serial numbers, day-first dates and the date order the user picks', async () => {
            const job = await uploadOk(
                Buffer.from('Name;Due\nA;46336\nB;03/04/2027\nC;31.12.2026\n'),
                'eu.csv'
            );
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job, { target: { mode: 'none' } }));
            expect(preview.body.date_columns.due.detected).toBe('dmy');
            const res = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job, { target: { mode: 'none' } }));
            expect(res.status).toBe(200);
            const local = async (name) => {
                const task = await Task.findOne({
                    where: { user_id: user.id, name },
                });
                return task.due_date.toISOString().slice(0, 10);
            };
            expect(await local('A')).toBe('2026-11-10');
            expect(await local('B')).toBe('2027-04-03');
            expect(await local('C')).toBe('2026-12-31');
        });

        it('reads a Greek CSV saved by Excel on Windows once the user picks the code page', async () => {
            const text = 'Όνομα;Κατάσταση\nΘεμέλια;Ολοκληρώθηκε\n';
            const buffer = iconv.encode(text, 'win1253');
            const guessed = await uploadOk(buffer, 'greek.csv');
            expect(guessed.encoding).toBe('win1252');
            const job = await uploadOk(buffer, 'greek.csv', {
                encoding: 'win1253',
            });
            expect(job.encoding).toBe('win1253');
            expect(job.sheets[0].headers).toEqual(['Όνομα', 'Κατάσταση']);
            expect(job.sheets[0].suggested_mapping).toEqual(['name', 'status']);
            await commit(job, { target: { mode: 'none' } });
            const [task] = await mine();
            expect(task.name).toBe('Θεμέλια');
            expect(task.status).toBe(Task.STATUS.DONE);
        });

        it('reads tab-separated and UTF-16 files', async () => {
            const tsv = await uploadOk(
                Buffer.from('Name\tTags\nTabbed\ta;b\n'),
                'tasks.tsv'
            );
            expect(tsv.sheets[0].headers).toEqual(['Name', 'Tags']);
            const utf16 = Buffer.concat([
                Buffer.from([0xff, 0xfe]),
                iconv.encode('Name\tNote\nWide\tΧ\n', 'utf16le'),
            ]);
            const wide = await uploadOk(utf16, 'unicode.txt');
            expect(wide.sheets[0].rows || wide.sheets[0].sample).toBeDefined();
            expect(wide.sheets[0].sample[0]).toEqual(['Wide', 'Χ']);
        });

        it('reports cells it cannot use without failing the import', async () => {
            const job = await uploadOk(
                Buffer.from(
                    [
                        'Name,Status,Priority,Due,Estimate,Tags,Assignee,Defer until',
                        'A,Approved,Whenever,someday,forever,"ok, bad#tag",Nobody Known,',
                        'B,,,2026-12-01,30,,,2026-12-05',
                        `${'x'.repeat(300)},,,,,,,`,
                    ].join('\n')
                ),
                'messy.csv'
            );
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job, { target: { mode: 'none' } }));
            const codes = (n) =>
                preview.body.rows
                    .find((r) => r.row_number === n)
                    .warnings.map((w) => w.code);
            expect(codes(2)).toEqual(
                expect.arrayContaining([
                    'unknown_status',
                    'unknown_priority',
                    'invalid_date',
                    'invalid_estimate',
                    'invalid_tag',
                    'unknown_assignee',
                ])
            );
            expect(codes(3)).toContain('defer_after_due');
            expect(codes(4)).toContain('name_truncated');
            expect(preview.body.unknown_values.status).toEqual(['Approved']);

            const res = await agent.post(`/api/imports/${job.uid}/commit`).send(
                optionsFor(job, {
                    target: { mode: 'none' },
                    value_map: {
                        status: { Approved: 2 },
                        priority: { Whenever: 0 },
                    },
                })
            );
            expect(res.status).toBe(200);
            const tasks = await byName();
            expect(tasks.A.status).toBe(Task.STATUS.DONE);
            expect(tasks.A.priority).toBe(Task.PRIORITY.LOW);
            expect(tasks.A.Tags.map((t) => t.name)).toEqual(['ok']);
            expect(tasks.B.defer_until).toBeNull();
            expect(tasks['x'.repeat(255)]).toBeDefined();
        });

        it('flags a file that was cut short', async () => {
            const lines = ['Name'];
            for (let i = 0; i < 5005; i++) lines.push(`Task ${i}`);
            const job = await uploadOk(
                Buffer.from(lines.join('\n')),
                'big.csv'
            );
            expect(job.sheets[0].truncated).toBe(true);
            expect(job.sheets[0].row_count).toBe(5000);
        });
    });

    describe('export round trips', () => {
        it('keeps awkward text intact through CSV and Excel', async () => {
            const project = await Project.create({
                name: 'Ελλάδα, "A"',
                user_id: user.id,
            });
            const names = [
                'Commas, "quotes" and\nnew lines',
                '=HYPERLINK("http://evil.example","click")',
                '+cmd|calc',
                '@SUM(1)',
                'مرحبا 👷 kanji 漢字',
            ];
            for (const name of names) {
                await Task.create({
                    name,
                    user_id: user.id,
                    project_id: project.id,
                    note: 'n\r\nm',
                });
            }
            const exports = {};
            for (const format of ['csv', 'xlsx']) {
                const exported = await agent
                    .get(
                        `/api/export/tasks?format=${format}&project_uid=${project.uid}`
                    )
                    .buffer(true)
                    .parse(binary);
                expect(exported.status).toBe(200);
                exports[format] = exported.body;
                const job = await uploadOk(exported.body, `back.${format}`);
                const preview = await agent
                    .post(`/api/imports/${job.uid}/preview`)
                    .send(optionsFor(job));
                expect(preview.body.counts).toMatchObject({
                    create: 0,
                    update: 5,
                    skip: 0,
                });
                expect(preview.body.rows.map((r) => r.name).sort()).toEqual(
                    [...names].sort()
                );
                await agent.delete(`/api/imports/${job.uid}`).expect(204);
            }

            // CSV cells that Excel would run as formulas get a leading '.
            const text = exports.csv.toString('utf8');
            expect(text).toContain(
                `"'=HYPERLINK(""http://evil.example"",""click"")"`
            );
            expect(text).toContain("'+cmd|calc");
            expect(text).toContain("'@SUM(1)");
            // Excel cells are written as text, never as formulas.
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(exports.xlsx);
            const formulas = [];
            wb.worksheets[0].eachRow((row) =>
                row.eachCell((cell) => {
                    if (cell.formula || cell.value?.formula) {
                        formulas.push(cell.address);
                    }
                })
            );
            expect(formulas).toEqual([]);
        });

        it('keeps dates and times on the same local day for users west of UTC', async () => {
            await User.update(
                { timezone: 'America/Los_Angeles' },
                { where: { id: user.id } }
            );
            const job = await uploadOk(
                Buffer.from(
                    'Name,Start,Due\nLate call,2026-11-20 23:30,2026-11-21\n'
                ),
                'tz.csv'
            );
            await commit(job, { target: { mode: 'none' } });
            const exported = await agent
                .get('/api/export/tasks?format=csv')
                .buffer(true)
                .parse(binary);
            const text = exported.body.toString('utf8');
            expect(text).toContain('2026-11-20 23:30');
            expect(text).toContain(',2026-11-21,');
        });

        it('exports tasks of shared projects and tasks assigned to the user, nothing else', async () => {
            const owner = await createTestUser({
                email: `owner_${Date.now()}@example.com`,
            });
            const ownerAgent = await login(owner);
            const shared = await Project.create({
                name: 'Shared build',
                user_id: owner.id,
            });
            await Task.create({
                name: 'Shared task',
                user_id: owner.id,
                project_id: shared.id,
            });
            await Task.create({ name: 'Private task', user_id: owner.id });
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: shared.uid,
                target_user_email: user.email,
                access_level: 'ro',
            });
            await acceptAllInvitations(agent);
            const exported = await agent
                .get('/api/export/tasks?format=csv')
                .buffer(true)
                .parse(binary);
            const text = exported.body.toString('utf8');
            expect(text).toContain('Shared task');
            expect(text).not.toContain('Private task');
        });
    });

    describe('security', () => {
        let other, otherAgent;

        beforeEach(async () => {
            other = await createTestUser({
                email: `victim_${Date.now()}_${Math.random()}@example.com`,
            });
            otherAgent = await login(other);
        });

        it("cannot update, parent under or import into another user's things", async () => {
            const theirProject = await Project.create({
                name: 'Theirs',
                user_id: other.id,
            });
            const theirTask = await Task.create({
                name: 'Their task',
                user_id: other.id,
                project_id: theirProject.id,
            });
            const job = await uploadOk(
                Buffer.from(
                    `UID,Name,Parent UID,Project\n${theirTask.uid},Hijacked,,Theirs\nChild,Child,${theirTask.uid},Theirs\n`.replace(
                        'Child,Child',
                        ',Child'
                    )
                ),
                'evil.csv'
            );
            const mapping = ['uid', 'name', 'parent', 'project'];
            const into = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(
                    optionsFor(job, {
                        mapping,
                        target: {
                            mode: 'project',
                            project_uid: theirProject.uid,
                        },
                    })
                );
            expect(into.body.problems.map((p) => p.code)).toContain(
                'target_project_invalid'
            );
            const blocked = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(
                    optionsFor(job, {
                        mapping,
                        target: {
                            mode: 'project',
                            project_uid: theirProject.uid,
                        },
                    })
                );
            expect(blocked.status).toBe(400);

            await commit(job, { mapping, target: { mode: 'column' } });
            await theirTask.reload();
            expect(theirTask.name).toBe('Their task');
            expect(
                await Task.count({ where: { parent_task_id: theirTask.id } })
            ).toBe(0);
            expect(
                await Task.count({ where: { project_id: theirProject.id } })
            ).toBe(1);
            // "Theirs" by name became the importer's own new project.
            const own = await Project.findOne({
                where: { user_id: user.id, name: 'Theirs' },
            });
            expect(own).not.toBeNull();
        });

        it('does not write into a project shared read-only', async () => {
            const shared = await Project.create({
                name: 'Read only',
                user_id: other.id,
            });
            await otherAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: shared.uid,
                target_user_email: user.email,
                access_level: 'ro',
            });
            await acceptAllInvitations(agent);
            const job = await uploadOk(Buffer.from('Name\nSneaky\n'), 'ro.csv');
            const res = await agent.post(`/api/imports/${job.uid}/commit`).send(
                optionsFor(job, {
                    target: { mode: 'project', project_uid: shared.uid },
                })
            );
            expect(res.status).toBe(400);
            const byColumn = await uploadOk(
                Buffer.from('Name,Project\nSneaky,Read only\n'),
                'ro2.csv'
            );
            await commit(byColumn);
            expect(await Task.count({ where: { project_id: shared.id } })).toBe(
                0
            );
        });

        it('ignores assignees the user cannot assign to, whatever the client sends', async () => {
            const theirContact = await Person.create({
                user_id: other.id,
                name: 'Their contact',
            });
            const job = await uploadOk(
                Buffer.from('Name,Assignee\nTask,Someone\n'),
                'a.csv'
            );
            await commit(job, {
                target: { mode: 'none' },
                value_map: {
                    assignee: { Someone: theirContact.uid },
                    status: { x: 99 },
                    priority: { y: -1 },
                },
            });
            const [task] = await mine();
            expect(task.assigned_to).toBeNull();
        });

        it('treats cells named like object properties as plain text', async () => {
            const job = await uploadOk(
                Buffer.from(
                    'Name,Status,Assignee,Priority\n__proto__,constructor,__proto__,toString\n'
                ),
                'proto.csv'
            );
            const res = await agent.post(`/api/imports/${job.uid}/commit`).send(
                optionsFor(job, {
                    target: { mode: 'none' },
                    value_map: JSON.parse(
                        '{"status":{"__proto__":2},"assignee":{"constructor":"x"}}'
                    ),
                })
            );
            expect(res.status).toBe(200);
            const [task] = await mine();
            expect(task.name).toBe('__proto__');
            expect(task.assigned_to).toBeNull();
            expect({}.polluted).toBeUndefined();
        });

        it('keeps import jobs to their owner, including undo and discard', async () => {
            const job = await uploadOk(Buffer.from('Name\nMine\n'), 'mine.csv');
            for (const [method, path] of [
                ['get', `/api/imports/${job.uid}`],
                ['post', `/api/imports/${job.uid}/columns`],
                ['post', `/api/imports/${job.uid}/commit`],
                ['post', `/api/imports/${job.uid}/undo`],
                ['delete', `/api/imports/${job.uid}`],
            ]) {
                const res = await otherAgent[method](path).send({});
                expect(res.status).toBe(404);
            }
            await commit(job, { target: { mode: 'none' } });
            expect(
                (await otherAgent.post(`/api/imports/${job.uid}/undo`)).status
            ).toBe(404);
            expect((await otherAgent.get('/api/imports')).body).toEqual([]);
        });

        it('refuses exports of areas and projects the user cannot see', async () => {
            const area = await Area.create({
                name: 'Hidden',
                user_id: other.id,
            });
            expect(
                (await agent.get(`/api/export/tasks?area_uid=${area.uid}`))
                    .status
            ).toBe(404);
            expect(
                (await agent.get('/api/export/tasks?project_uid=nope')).status
            ).toBe(404);
        });

        it('requires a session for every endpoint', async () => {
            for (const [method, path] of [
                ['get', '/api/export/tasks'],
                ['get', '/api/export/template'],
                ['get', '/api/imports'],
                ['post', '/api/imports'],
            ]) {
                const res = await request(app)[method](path);
                expect(res.status).toBe(401);
            }
        });

        it('stops zip bombs before Excel parsing', async () => {
            const bomb = zipWith(
                'xl/sharedStrings.xml',
                Buffer.alloc(200 * 1024 * 1024, 0x41)
            );
            expect(bomb.length).toBeLessThan(1024 * 1024);
            const res = await upload(bomb, 'bomb.xlsx');
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('too large once unpacked');
        });

        it('does not expand XML entities', async () => {
            const good = await xlsx(async (wb) => {
                wb.addWorksheet('S').addRow(['Name']);
            });
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(good);
            const laughs =
                '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>&lol9;</t></si></sst>';
            zip.file('xl/sharedStrings.xml', laughs);
            const evil = await zip.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });
            const started = Date.now();
            const res = await upload(evil, 'laughs.xlsx');
            expect(Date.now() - started).toBeLessThan(5000);
            expect([201, 400]).toContain(res.status);
            expect(JSON.stringify(res.body).length).toBeLessThan(100000);
        });

        it('caps text amplified through shared strings', async () => {
            const buffer = await xlsx(async (wb) => {
                const sheet = wb.addWorksheet('S');
                sheet.addRow(['Name', 'Note']);
                const long = 'y'.repeat(9000);
                for (let i = 0; i < 1200; i++) sheet.addRow([`T${i}`, long]);
            });
            expect(buffer.length).toBeLessThan(5 * 1024 * 1024);
            const res = await upload(buffer, 'amplified.xlsx');
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('too much text');
        });

        it('rejects oversized and wrongly typed uploads and unknown encodings', async () => {
            const big = await upload(
                Buffer.alloc(5 * 1024 * 1024 + 10, 0x61),
                'big.csv'
            );
            expect(big.status).toBe(400);
            expect((await upload(Buffer.from('MZ'), 'run.exe')).status).toBe(
                400
            );
            expect(
                (
                    await upload(Buffer.from('a\n'), 'x.csv', {
                        encoding: 'base64',
                    })
                ).status
            ).toBe(400);
            const noRows = await upload(Buffer.from('\n\n'), 'empty.csv');
            expect(noRows.status).toBe(400);
        });

        it('keeps at most five uploads waiting per user', async () => {
            const uids = [];
            for (let i = 0; i < 7; i++) {
                uids.push(
                    (await uploadOk(Buffer.from(`Name\nT${i}\n`), `f${i}.csv`))
                        .uid
                );
            }
            const statuses = [];
            for (const uid of uids) {
                statuses.push((await agent.get(`/api/imports/${uid}`)).status);
            }
            expect(statuses.filter((s) => s === 200)).toHaveLength(5);
            expect(statuses.slice(-5)).toEqual([200, 200, 200, 200, 200]);
        });

        it('refuses a sheet that would create hundreds of projects', async () => {
            const lines = ['Name,Project'];
            for (let i = 0; i < 250; i++) lines.push(`T${i},P${i}`);
            const job = await uploadOk(
                Buffer.from(lines.join('\n')),
                'many.csv'
            );
            const res = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job));
            expect(res.status).toBe(400);
            expect(await Project.count({ where: { user_id: user.id } })).toBe(
                0
            );
        });

        it('sends no webhooks per imported row', async () => {
            const dispatcher = require('../../modules/webhooks/dispatcher');
            const spy = jest.spyOn(dispatcher, 'emit');
            const job = await uploadOk(
                Buffer.from('Name\nA\nB\n'),
                'quiet.csv'
            );
            await commit(job, { target: { mode: 'none' } });
            expect(
                spy.mock.calls.filter(([, event]) => event === 'task.created')
            ).toHaveLength(0);
            spy.mockRestore();
        });

        it('rolls the whole import back when one write fails', async () => {
            const job = await uploadOk(
                Buffer.from('Name,Project\nA,New one\nB,New one\n'),
                'rb.csv'
            );
            const original = Task.create.bind(Task);
            let calls = 0;
            const spy = jest
                .spyOn(Task, 'create')
                .mockImplementation((...args) => {
                    calls++;
                    if (calls === 2) throw new Error('disk full');
                    return original(...args);
                });
            const res = await agent
                .post(`/api/imports/${job.uid}/commit`)
                .send(optionsFor(job));
            spy.mockRestore();
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(0);
            expect(await Project.count({ where: { user_id: user.id } })).toBe(
                0
            );
            // The upload is still there to try again.
            expect(
                (await agent.get(`/api/imports/${job.uid}`)).body.status
            ).toBe('parsed');
        });
    });
    describe('review findings', () => {
        let other, otherAgent;

        beforeEach(async () => {
            other = await createTestUser({
                email: `owner2_${Date.now()}_${Math.random()}@example.com`,
            });
            otherAgent = await login(other);
        });

        it('reads long date and estimate cells quickly', async () => {
            const long = '12 '.repeat(3000);
            const lines = ['Name,Due,Estimate'];
            for (let i = 0; i < 250; i++) {
                lines.push(`T${i},"${long}",${'1'.repeat(9000)}x`);
            }
            const job = await uploadOk(
                Buffer.from(lines.join('\n')),
                'slow.csv'
            );
            const started = Date.now();
            const res = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(optionsFor(job, { target: { mode: 'none' } }));
            expect(res.status).toBe(200);
            expect(Date.now() - started).toBeLessThan(3000);
            const codes = res.body.rows[0].warnings.map((w) => w.code);
            expect(codes).toEqual(
                expect.arrayContaining(['invalid_date', 'invalid_estimate'])
            );
            expect(
                res.body.rows[0].warnings[0].value.length
            ).toBeLessThanOrEqual(80);
        });

        it('sees through a zip whose end record lies about its entry count', async () => {
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(
                await xlsx(async (wb) => wb.addWorksheet('S').addRow(['Name']))
            );
            const row = '<row>' + '<c t="s"><v>0</v></c>'.repeat(60) + '</row>';
            zip.file(
                'xl/worksheets/sheet1.xml',
                `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${row.repeat(30000)}</sheetData></worksheet>`
            );
            const out = await zip.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });
            const eocd = out.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
            out.writeUInt16LE(1, eocd + 8);
            out.writeUInt16LE(1, eocd + 10);
            const res = await upload(out, 'liar.xlsx');
            expect(res.status).toBe(400);
        });

        it('does not put subtasks under a task that is only assigned to the user', async () => {
            const privateProject = await Project.create({
                name: 'Private',
                user_id: other.id,
            });
            const me = await Person.findOne({
                where: { user_id: user.id, linked_user_id: user.id },
            });
            const assigned = await Task.create({
                name: 'Assigned to me',
                user_id: other.id,
                project_id: privateProject.id,
                assigned_to: me.uid,
            });
            const job = await uploadOk(
                Buffer.from(`Name,Parent UID\nSneaky child,${assigned.uid}\n`),
                'assigned.csv'
            );
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send(
                    optionsFor(job, {
                        mapping: ['name', 'parent'],
                        target: { mode: 'none' },
                    })
                );
            expect(preview.body.rows[0].warnings.map((w) => w.code)).toContain(
                'parent_not_found'
            );
            await commit(job, {
                mapping: ['name', 'parent'],
                target: { mode: 'none' },
            });
            const child = await Task.findOne({
                where: { user_id: user.id, name: 'Sneaky child' },
            });
            expect(child.parent_task_id).toBeNull();
            expect(child.project_id).toBeNull();
            expect(
                await Task.count({ where: { project_id: privateProject.id } })
            ).toBe(1);
        });

        it('runs a commit once when it is sent twice at the same time', async () => {
            const lines = ['Name'];
            for (let i = 0; i < 50; i++) lines.push(`Row ${i}`);
            const job = await uploadOk(
                Buffer.from(lines.join('\n')),
                'twice.csv'
            );
            const options = optionsFor(job, { target: { mode: 'none' } });
            const results = await Promise.all([
                request(app)
                    .post(`/api/imports/${job.uid}/commit`)
                    .set(
                        'Cookie',
                        agent.jar
                            .getCookies({
                                path: '/',
                                domain: '127.0.0.1',
                                secure: false,
                                script: false,
                            })
                            .toValueString()
                    )
                    .send(options),
                agent.post(`/api/imports/${job.uid}/commit`).send(options),
            ]);
            const statuses = results.map((r) => r.status).sort();
            expect(statuses).toContain(200);
            expect(await Task.count({ where: { user_id: user.id } })).toBe(50);
        });

        it('keeps tasks changed since the import when undoing it', async () => {
            const job = await uploadOk(
                Buffer.from('Name\nKeep me\nDrop me\n'),
                'k.csv'
            );
            await commit(job, { target: { mode: 'none' } });
            const { ImportJob } = require('../../models');
            await ImportJob.update(
                { committed_at: new Date(Date.now() - 60000) },
                { where: { uid: job.uid } }
            );
            const keep = await Task.findOne({
                where: { user_id: user.id, name: 'Keep me' },
            });
            const { sequelize } = require('../../models');
            await sequelize.query(
                'UPDATE tasks SET updated_at = ? WHERE user_id = ?',
                { replacements: [new Date(Date.now() - 60000), user.id] }
            );
            await keep.update({ note: 'worked on it' });
            const res = await agent.post(`/api/imports/${job.uid}/undo`);
            expect(res.status).toBe(200);
            expect(res.body.kept_changed).toBe(1);
            const left = await mine();
            expect(left.map((t) => t.name)).toEqual(['Keep me']);
        });

        it('records task history for updates', async () => {
            const { TaskEvent } = require('../../models');
            const task = await Task.create({
                name: 'Logged',
                user_id: user.id,
            });
            const job = await uploadOk(
                Buffer.from(`UID,Name,Status\n${task.uid},Logged,Done\n`),
                'log.csv'
            );
            await commit(job, { target: { mode: 'none' } });
            const events = await TaskEvent.findAll({
                where: { task_id: task.id },
            });
            expect(events.length).toBeGreaterThan(0);
        });

        it("leaves a hidden parent's name out of an export", async () => {
            const privateProject = await Project.create({
                name: 'Private',
                user_id: other.id,
            });
            const me = await Person.findOne({
                where: { user_id: user.id, linked_user_id: user.id },
            });
            const secretParent = await Task.create({
                name: 'Secret parent',
                user_id: other.id,
                project_id: privateProject.id,
            });
            await Task.create({
                name: 'My subtask',
                user_id: other.id,
                project_id: privateProject.id,
                parent_task_id: secretParent.id,
                assigned_to: me.uid,
            });
            const exported = await agent
                .get('/api/export/tasks?format=csv')
                .buffer(true)
                .parse(binary);
            const text = exported.body.toString('utf8');
            expect(text).toContain('My subtask');
            expect(text).not.toContain('Secret parent');
            expect(text).not.toContain(secretParent.uid);
        });

        it('exports projects whose names Excel refuses as sheet names', async () => {
            for (const name of ["'quoted'", 'History', 'a/b:c*?[d]']) {
                const project = await Project.create({
                    name,
                    user_id: user.id,
                });
                await Task.create({
                    name: 'T',
                    user_id: user.id,
                    project_id: project.id,
                });
                const res = await agent.get(
                    `/api/export/tasks?format=xlsx&project_uid=${project.uid}`
                );
                expect(res.status).toBe(200);
            }
        });

        it('answers bad sheet numbers with 400, not 500', async () => {
            const job = await uploadOk(Buffer.from('Name\nA\n'), 'a.csv');
            for (const sheet of ['constructor', 5, -1, '0']) {
                const res = await agent
                    .post(`/api/imports/${job.uid}/columns`)
                    .send({ sheet });
                expect(res.status).toBe(400);
            }
            const preview = await agent
                .post(`/api/imports/${job.uid}/preview`)
                .send({ sheet: 9 });
            expect(preview.status).toBe(400);
        });
    });
});
