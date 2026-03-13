const BaseRepository = require('../../../shared/database/BaseRepository');
const { User } = require('../../../models');
const bcrypt = require('bcrypt');

describe('BaseRepository', () => {
    let repo;

    beforeAll(() => {
        repo = new BaseRepository(User);
    });

    describe('create', () => {
        it('should create a record', async () => {
            const hash = await bcrypt.hash('pass', 10);
            const user = await repo.create({ email: 'base-repo@test.com', password_digest: hash });
            expect(user.id).toBeDefined();
            expect(user.email).toBe('base-repo@test.com');
        });
    });

    describe('findById', () => {
        it('should find a record by primary key', async () => {
            const hash = await bcrypt.hash('pass', 10);
            const created = await repo.create({ email: 'findbyid@test.com', password_digest: hash });
            const found = await repo.findById(created.id);
            expect(found).not.toBeNull();
            expect(found.email).toBe('findbyid@test.com');
        });

        it('should return null for non-existent id', async () => {
            const found = await repo.findById(999999);
            expect(found).toBeNull();
        });
    });

    describe('findOne', () => {
        it('should find a record by where clause', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'findone@test.com', password_digest: hash });
            const found = await repo.findOne({ email: 'findone@test.com' });
            expect(found).not.toBeNull();
            expect(found.email).toBe('findone@test.com');
        });

        it('should return null when no match', async () => {
            const found = await repo.findOne({ email: 'nonexistent@test.com' });
            expect(found).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should return all matching records', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'findall1@test.com', password_digest: hash });
            await repo.create({ email: 'findall2@test.com', password_digest: hash });
            const all = await repo.findAll();
            expect(all.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter with where clause', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'specific@test.com', password_digest: hash });
            const results = await repo.findAll({ email: 'specific@test.com' });
            expect(results).toHaveLength(1);
            expect(results[0].email).toBe('specific@test.com');
        });
    });

    describe('update', () => {
        it('should update instance fields', async () => {
            const hash = await bcrypt.hash('pass', 10);
            const user = await repo.create({ email: 'update@test.com', password_digest: hash });
            await repo.update(user, { email: 'updated@test.com' });
            await user.reload();
            expect(user.email).toBe('updated@test.com');
        });
    });

    describe('destroy', () => {
        it('should delete a record', async () => {
            const hash = await bcrypt.hash('pass', 10);
            const user = await repo.create({ email: 'destroy@test.com', password_digest: hash });
            const id = user.id;
            await repo.destroy(user);
            const found = await repo.findById(id);
            expect(found).toBeNull();
        });
    });

    describe('count', () => {
        it('should count all records', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'count1@test.com', password_digest: hash });
            const c = await repo.count();
            expect(c).toBeGreaterThanOrEqual(1);
        });

        it('should count with where clause', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'countfilter@test.com', password_digest: hash });
            const c = await repo.count({ email: 'countfilter@test.com' });
            expect(c).toBe(1);
        });
    });

    describe('exists', () => {
        it('should return true when record exists', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await repo.create({ email: 'exists@test.com', password_digest: hash });
            const result = await repo.exists({ email: 'exists@test.com' });
            expect(result).toBe(true);
        });

        it('should return false when record does not exist', async () => {
            const result = await repo.exists({ email: 'doesnotexist@test.com' });
            expect(result).toBe(false);
        });
    });
});