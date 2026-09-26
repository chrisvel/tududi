const path = require('path');
const fs = require('fs').promises;
const {
    Area,
    Goal,
    Project,
    Task,
    Tag,
    Note,
    Person,
    RecurringCompletion,
    Role,
    TaskAttachment,
    InboxItem,
    InboxItemAttachment,
    ProjectAttachment,
    NoteAttachment,
    User,
} = require('../../models');
const { getConfig } = require('../../config/config');
const {
    exportUserData,
    importUserData,
} = require('../../services/userDataTransfer');
const { validateBackupData } = require('../../services/backupService');
const peopleService = require('../../modules/people/service');
const { createTestUser } = require('../helpers/testUtils');
const { eraseUserAccount } = require('../../services/accountErasureService');

const config = getConfig();

// Builds a user with one of everything the export carries, wired together.
async function seedSource(user) {
    const area = await Area.create({ name: 'Work', user_id: user.id });
    const goal = await Goal.create({
        title: 'Ship v2',
        user_id: user.id,
        area_id: area.id,
    });
    const tag = await Tag.create({ name: 'urgent', user_id: user.id });
    const project = await Project.create({
        name: 'Launch',
        user_id: user.id,
        area_id: area.id,
        goal_id: goal.id,
    });
    await project.setTags([tag.id]);

    const self = await peopleService.createSelfPerson(user);
    const contact = await Person.create({
        name: 'Dana',
        user_id: user.id,
        email: 'dana@example.com',
    });

    const parent = await Task.create({
        name: 'Parent',
        user_id: user.id,
        project_id: project.id,
        goal_id: goal.id,
        assigned_to: contact.uid,
        involves: [self.uid, contact.uid],
    });
    await parent.setTags([tag.id]);
    const child = await Task.create({
        name: 'Child',
        user_id: user.id,
        project_id: project.id,
        parent_task_id: parent.id,
    });
    const recurring = await Task.create({
        name: 'Weekly',
        user_id: user.id,
        recurrence_type: 'weekly',
        recurrence_interval: 1,
    });
    await RecurringCompletion.create({
        task_id: recurring.id,
        completed_at: new Date('2026-09-01T10:00:00Z'),
        original_due_date: new Date('2026-09-01T00:00:00Z'),
        skipped: false,
    });
    const instance = await Task.create({
        name: 'Weekly instance',
        user_id: user.id,
        recurring_parent_id: recurring.id,
    });

    const uploadsDir = path.join(config.uploadPath, 'tasks');
    await fs.mkdir(uploadsDir, { recursive: true });
    const stored = `roundtrip-${Date.now()}.txt`;
    await fs.writeFile(path.join(uploadsDir, stored), 'attached bytes');
    await TaskAttachment.create({
        task_id: parent.id,
        user_id: user.id,
        original_filename: 'brief.txt',
        stored_filename: stored,
        file_size: 14,
        mime_type: 'text/plain',
        file_path: `tasks/${stored}`,
    });

    const note = await Note.create({
        title: 'Plan',
        content: 'body',
        user_id: user.id,
        project_id: project.id,
    });
    await note.setTags([tag.id]);

    // Files stored on disk and referenced by URL (project cover image,
    // user avatar) rather than embedded in the backup like task attachments.
    const projectImagesDir = path.join(config.uploadPath, 'projects');
    await fs.mkdir(projectImagesDir, { recursive: true });
    const projectImageFile = `roundtrip-project-${Date.now()}.png`;
    await fs.writeFile(
        path.join(projectImagesDir, projectImageFile),
        'project image bytes'
    );
    await project.update({
        image_url: `/api/uploads/projects/${projectImageFile}`,
    });

    const avatarsDir = path.join(config.uploadPath, 'avatars');
    await fs.mkdir(avatarsDir, { recursive: true });
    const avatarFile = `roundtrip-avatar-${Date.now()}.png`;
    await fs.writeFile(path.join(avatarsDir, avatarFile), 'avatar bytes');
    await user.update({
        avatar_image: `/uploads/avatars/${avatarFile}`,
        appearance: 'dark',
    });

    return {
        area,
        goal,
        tag,
        project,
        self,
        contact,
        parent,
        child,
        recurring,
        instance,
    };
}

describe('Backup export and import round trip (format 2)', () => {
    let source, target, seeded;

    beforeEach(async () => {
        source = await createTestUser({
            email: `src_${Date.now()}@example.com`,
            name: 'Source',
        });
        target = await createTestUser({
            email: `dst_${Date.now()}@example.com`,
            name: 'Target',
        });
        seeded = await seedSource(source);
    });

    it('exports uid references, goals, people, and attachment contents', async () => {
        const backup = await exportUserData(source.id);

        expect(backup.format).toBe(2);
        expect(validateBackupData(backup).valid).toBe(true);
        expect(backup.data.goals).toHaveLength(1);
        expect(backup.data.goals[0].area_uid).toBe(seeded.area.uid);
        expect(backup.data.people.map((p) => p.name).sort()).toEqual(
            ['Dana', 'Source'].sort()
        );
        expect(
            backup.data.people.find((p) => p.name === 'Source').is_self
        ).toBe(true);
        expect(
            backup.data.people.every((p) => p.linked_user_id === undefined)
        ).toBe(true);

        const project = backup.data.projects[0];
        expect(project.area_uid).toBe(seeded.area.uid);
        expect(project.goal_uid).toBe(seeded.goal.uid);
        expect(project.tag_uids).toEqual([seeded.tag.uid]);
        expect(Buffer.from(project.cover_image.data, 'base64').toString()).toBe(
            'project image bytes'
        );

        expect(backup.user.appearance).toBe('dark');
        expect(
            Buffer.from(backup.user.avatar_image_data.data, 'base64').toString()
        ).toBe('avatar bytes');

        const parent = backup.data.tasks.find((t) => t.name === 'Parent');
        expect(parent.project_uid).toBe(seeded.project.uid);
        expect(parent.goal_uid).toBe(seeded.goal.uid);
        expect(parent.attachments).toHaveLength(1);
        expect(
            Buffer.from(parent.attachments[0].data, 'base64').toString()
        ).toBe('attached bytes');
        const child = backup.data.tasks.find((t) => t.name === 'Child');
        expect(child.parent_task_uid).toBe(seeded.parent.uid);
        const instance = backup.data.tasks.find(
            (t) => t.name === 'Weekly instance'
        );
        expect(instance.recurring_parent_uid).toBe(seeded.recurring.uid);
        const weekly = backup.data.tasks.find((t) => t.name === 'Weekly');
        expect(weekly.completions).toHaveLength(1);

        expect(JSON.stringify(backup.user)).not.toMatch(/password/);
    });

    it('imports into another user with every link intact and no reference to the source', async () => {
        const backup = await exportUserData(source.id);
        await peopleService.createSelfPerson(target);
        // Cross-instance case: the source account is gone, so the backup's
        // uids are free and are kept.
        // The source is the only admin, and the last admin cannot be erased.
        await Role.update(
            { role: 'admin', is_admin: true },
            { where: { user_id: target.id } }
        );
        await eraseUserAccount(source.id);

        const stats = await importUserData(target.id, backup);
        expect(stats.tasks.created).toBe(4);
        expect(stats.goals.created).toBe(1);
        expect(stats.people.created).toBe(1);
        expect(stats.attachments.created).toBe(1);

        const area = await Area.findOne({ where: { user_id: target.id } });
        const goal = await Goal.findOne({ where: { user_id: target.id } });
        expect(goal.area_id).toBe(area.id);

        const project = await Project.findOne({
            where: { user_id: target.id },
        });
        expect(project.area_id).toBe(area.id);
        expect(project.goal_id).toBe(goal.id);
        expect(project.id).not.toBe(seeded.project.id);
        expect((await project.getTags()).map((t) => t.name)).toEqual([
            'urgent',
        ]);
        expect(project.image_url).toMatch(/^\/api\/uploads\/projects\//);
        const projectImageContent = await fs.readFile(
            path.join(
                config.uploadPath,
                'projects',
                path.basename(project.image_url)
            ),
            'utf8'
        );
        expect(projectImageContent).toBe('project image bytes');

        // The target's own profile picks up the backed-up account details
        // (#1603), but never the source's email/password.
        const updatedTarget = await User.findByPk(target.id);
        expect(updatedTarget.appearance).toBe('dark');
        expect(updatedTarget.email).toBe(target.email);
        expect(updatedTarget.avatar_image).toMatch(/^\/uploads\/avatars\//);
        const avatarContent = await fs.readFile(
            path.join(
                config.uploadPath,
                'avatars',
                path.basename(updatedTarget.avatar_image)
            ),
            'utf8'
        );
        expect(avatarContent).toBe('avatar bytes');

        const parent = await Task.findOne({
            where: { user_id: target.id, name: 'Parent' },
        });
        const child = await Task.findOne({
            where: { user_id: target.id, name: 'Child' },
        });
        expect(parent.project_id).toBe(project.id);
        expect(parent.goal_id).toBe(goal.id);
        expect(child.parent_task_id).toBe(parent.id);

        const recurring = await Task.findOne({
            where: { user_id: target.id, name: 'Weekly' },
        });
        const instance = await Task.findOne({
            where: { user_id: target.id, name: 'Weekly instance' },
        });
        expect(instance.recurring_parent_id).toBe(recurring.id);
        expect(
            await RecurringCompletion.count({
                where: { task_id: recurring.id },
            })
        ).toBe(1);

        // The source's self card became the target's own card; the contact
        // came across as a new person; the task points at the new uids.
        const targetSelf = await Person.findOne({
            where: { user_id: target.id, linked_user_id: target.id },
        });
        const dana = await Person.findOne({
            where: { user_id: target.id, name: 'Dana' },
        });
        expect(dana).not.toBeNull();
        expect(parent.assigned_to).toBe(dana.uid);
        expect(parent.involves).toEqual(
            expect.arrayContaining([targetSelf.uid, dana.uid])
        );
        expect(await Person.count({ where: { user_id: target.id } })).toBe(2);

        const attachment = await TaskAttachment.findOne({
            where: { user_id: target.id },
        });
        expect(attachment.task_id).toBe(parent.id);
        expect(attachment.original_filename).toBe('brief.txt');
        const content = await fs.readFile(
            path.join(config.uploadPath, attachment.file_path),
            'utf8'
        );
        expect(content).toBe('attached bytes');

        const note = await Note.findOne({ where: { user_id: target.id } });
        expect(note.project_id).toBe(project.id);

        expect(parent.uid).toBe(seeded.parent.uid);

        // Importing the same backup again changes nothing
        const again = await importUserData(target.id, backup);
        expect(again.tasks.created).toBe(0);
        expect(await Task.count({ where: { user_id: target.id } })).toBe(4);
    });

    it('imports alongside the source account on the same instance with fresh uids', async () => {
        const backup = await exportUserData(source.id);
        await peopleService.createSelfPerson(target);

        const stats = await importUserData(target.id, backup);
        expect(stats.tasks.created).toBe(4);

        const parent = await Task.findOne({
            where: { user_id: target.id, name: 'Parent' },
        });
        expect(parent.uid).not.toBe(seeded.parent.uid);
        const child = await Task.findOne({
            where: { user_id: target.id, name: 'Child' },
        });
        expect(child.parent_task_id).toBe(parent.id);

        // The source is untouched
        expect(await Task.count({ where: { user_id: source.id } })).toBe(4);
        expect((await Task.findByPk(seeded.child.id)).parent_task_id).toBe(
            seeded.parent.id
        );
    });

    it('reports zeroed stats for every category when the backup has no rows', async () => {
        const empty = {
            version: '2',
            data: { projects: [], tasks: [], notes: [] },
        };

        const stats = await importUserData(target.id, empty);

        for (const key of ['tasks', 'projects', 'notes', 'tags', 'areas']) {
            expect(stats[key]).toEqual({ created: 0, skipped: 0 });
        }
    });

    it('does not touch the account profile when merge is disabled', async () => {
        const backup = await exportUserData(source.id);
        await peopleService.createSelfPerson(target);

        await importUserData(target.id, backup, { merge: false });

        const untouchedTarget = await User.findByPk(target.id);
        expect(untouchedTarget.appearance).toBe('light');
        expect(untouchedTarget.avatar_image).toBeFalsy();
    });

    it('never links a legacy backup to another user rows by numeric id', async () => {
        // A format-1 backup carries the source's numeric ids and no uids
        const legacy = {
            version: '1.4.2',
            data: {
                areas: [],
                tags: [],
                projects: [
                    {
                        uid: 'legacy-project',
                        name: 'Legacy',
                        area_id: seeded.area.id,
                        goal_id: seeded.goal.id,
                    },
                ],
                tasks: [
                    {
                        uid: 'legacy-task',
                        name: 'Legacy task',
                        project_id: seeded.project.id,
                        parent_task_id: seeded.parent.id,
                    },
                ],
                notes: [],
            },
        };

        await importUserData(target.id, legacy);

        const project = await Project.findOne({
            where: { uid: 'legacy-project' },
        });
        expect(project.user_id).toBe(target.id);
        expect(project.area_id).toBeNull();
        expect(project.goal_id).toBeNull();
        const task = await Task.findOne({ where: { uid: 'legacy-task' } });
        expect(task.project_id).toBeNull();
        expect(task.parent_task_id).toBeNull();
    });

    it('carries inbox item files through export and import', async () => {
        const inboxDir = path.join(config.uploadPath, 'inbox');
        await fs.mkdir(inboxDir, { recursive: true });
        await fs.writeFile(
            path.join(inboxDir, 'inbox-roundtrip.png'),
            'inbox bytes'
        );
        const item = await InboxItem.create({
            content: 'Receipt',
            title: 'Receipt',
            source: 'web',
            user_id: source.id,
        });
        await InboxItemAttachment.create({
            inbox_item_id: item.id,
            user_id: source.id,
            original_filename: 'receipt.png',
            stored_filename: 'inbox-roundtrip.png',
            file_size: 11,
            mime_type: 'image/png',
            file_path: 'inbox/inbox-roundtrip.png',
        });

        const backup = await exportUserData(source.id);
        const exported = backup.data.inbox_items.find(
            (entry) => entry.uid === item.uid
        );
        expect(exported.attachments).toHaveLength(1);
        expect(exported.Attachments).toBeUndefined();

        await importUserData(target.id, backup);

        const imported = await InboxItemAttachment.findOne({
            where: { user_id: target.id },
        });
        expect(imported.original_filename).toBe('receipt.png');
        expect(imported.file_path).toMatch(/^inbox\//);
        const content = await fs.readFile(
            path.join(config.uploadPath, imported.file_path),
            'utf8'
        );
        expect(content).toBe('inbox bytes');
    });

    it('carries project and note files through, relinking the note text', async () => {
        for (const dir of ['project-files', 'note-files']) {
            await fs.mkdir(path.join(config.uploadPath, dir), {
                recursive: true,
            });
        }
        await fs.writeFile(
            path.join(config.uploadPath, 'project-files', 'project-rt.pdf'),
            'project bytes'
        );
        await fs.writeFile(
            path.join(config.uploadPath, 'note-files', 'note-rt.png'),
            'note bytes'
        );
        const project = await Project.create({
            name: 'Files project',
            user_id: source.id,
        });
        await ProjectAttachment.create({
            project_id: project.id,
            user_id: source.id,
            original_filename: 'brief.pdf',
            stored_filename: 'project-rt.pdf',
            file_size: 13,
            mime_type: 'application/pdf',
            file_path: 'project-files/project-rt.pdf',
        });
        const note = await Note.create({
            title: 'Files note',
            content: 'See ![shot](/api/uploads/note-files/note-rt.png)',
            user_id: source.id,
        });
        await NoteAttachment.create({
            note_id: note.id,
            user_id: source.id,
            original_filename: 'shot.png',
            stored_filename: 'note-rt.png',
            file_size: 10,
            mime_type: 'image/png',
            file_path: 'note-files/note-rt.png',
        });

        const backup = await exportUserData(source.id);
        // Import next to the source, so every stored name must be new.
        await importUserData(target.id, backup);

        const projectFile = await ProjectAttachment.findOne({
            where: { user_id: target.id },
        });
        expect(projectFile.original_filename).toBe('brief.pdf');
        expect(projectFile.stored_filename).not.toBe('project-rt.pdf');

        const noteFile = await NoteAttachment.findOne({
            where: { user_id: target.id },
        });
        const importedNote = await Note.findByPk(noteFile.note_id);
        expect(importedNote.content).toBe(
            `See ![shot](/api/uploads/note-files/${noteFile.stored_filename})`
        );
        const content = await fs.readFile(
            path.join(config.uploadPath, noteFile.file_path),
            'utf8'
        );
        expect(content).toBe('note bytes');
    });
});
