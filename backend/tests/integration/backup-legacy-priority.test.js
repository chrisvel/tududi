const { Project, Task } = require('../../models');
const { importUserData } = require('../../services/userDataTransfer');
const { createTestUser } = require('../helpers/testUtils');

// Older installs stored some priorities as names. SQLite kept them in the
// integer column, Postgres rejects them, so a restore must map them back.
describe('restoring a backup with priority names', () => {
    it('stores priority names as their numbers', async () => {
        const user = await createTestUser({ email: 'legacy@example.com' });
        const backup = {
            version: 'v1.6.1',
            format: 2,
            data: {
                areas: [],
                projects: [
                    { uid: 'legacyproj00001', name: 'Low', priority: 'low' },
                    { uid: 'legacyproj00002', name: 'High', priority: 'high' },
                    { uid: 'legacyproj00003', name: 'Odd', priority: 'soon' },
                ],
                tasks: [
                    {
                        uid: 'legacytask00001',
                        name: 'Medium',
                        priority: 'medium',
                        status: 0,
                    },
                ],
                tags: [],
                notes: [],
            },
        };

        await importUserData(user.id, backup, { merge: true });

        const byName = Object.fromEntries(
            (await Project.findAll({ where: { user_id: user.id } })).map(
                (p) => [p.name, p.priority]
            )
        );
        expect(byName).toEqual({ Low: 0, High: 2, Odd: null });
        const task = await Task.findOne({ where: { uid: 'legacytask00001' } });
        expect(task.priority).toBe(1);
    });
});
