const { Area, User } = require('../../../models');

describe('Area Model', () => {
    let user;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create an area with valid data', async () => {
            const areaData = {
                name: 'Work',
                description: 'Work related projects',
                user_id: user.id,
            };

            const area = await Area.create(areaData);

            expect(area.name).toBe(areaData.name);
            expect(area.description).toBe(areaData.description);
            expect(area.user_id).toBe(user.id);
        });

        it('should require name', async () => {
            const areaData = {
                description: 'Area without name',
                user_id: user.id,
            };

            await expect(Area.create(areaData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const areaData = {
                name: 'Test Area',
            };

            await expect(Area.create(areaData)).rejects.toThrow();
        });

        it('should allow null description', async () => {
            const areaData = {
                name: 'Test Area',
                user_id: user.id,
                description: null,
            };

            const area = await Area.create(areaData);
            expect(area.description).toBeNull();
        });
    });

    describe('associations', () => {
        it('should belong to a user', async () => {
            const area = await Area.create({
                name: 'Test Area',
                user_id: user.id,
            });

            const areaWithUser = await Area.findByPk(area.id, {
                include: [{ model: User }],
            });

            expect(areaWithUser.User).toBeDefined();
            expect(areaWithUser.User.id).toBe(user.id);
            expect(areaWithUser.User.email).toBe(user.email);
        });
    });
});
