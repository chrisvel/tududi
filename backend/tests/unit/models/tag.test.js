const { Tag, User } = require('../../../models');

describe('Tag Model', () => {
    let user;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create a tag with valid data', async () => {
            const tagData = {
                name: 'work',
                user_id: user.id,
            };

            const tag = await Tag.create(tagData);

            expect(tag.name).toBe(tagData.name);
            expect(tag.user_id).toBe(user.id);
        });

        it('should require name', async () => {
            const tagData = {
                user_id: user.id,
            };

            await expect(Tag.create(tagData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const tagData = {
                name: 'work',
            };

            await expect(Tag.create(tagData)).rejects.toThrow();
        });

        it('should allow multiple tags with same name for different users', async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const tag1 = await Tag.create({
                name: 'work',
                user_id: user.id,
            });

            const tag2 = await Tag.create({
                name: 'work',
                user_id: otherUser.id,
            });

            expect(tag1.name).toBe('work');
            expect(tag2.name).toBe('work');
            expect(tag1.user_id).toBe(user.id);
            expect(tag2.user_id).toBe(otherUser.id);
        });
    });

    describe('associations', () => {
        it('should belong to a user', async () => {
            const tag = await Tag.create({
                name: 'work',
                user_id: user.id,
            });

            const tagWithUser = await Tag.findByPk(tag.id, {
                include: [{ model: User }],
            });

            expect(tagWithUser.User).toBeDefined();
            expect(tagWithUser.User.id).toBe(user.id);
            expect(tagWithUser.User.email).toBe(user.email);
        });
    });
});
