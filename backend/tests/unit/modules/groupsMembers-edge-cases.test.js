jest.mock('../../../services/logService', () => ({
    ...jest.requireActual('../../../services/logService'),
    logError: jest.fn(),
}));
jest.mock('../../../services/seatsService', () => ({
    ...jest.requireActual('../../../services/seatsService'),
    reconcile: jest.fn(),
}));

const { UniqueConstraintError } = require('sequelize');
const groupsService = require('../../../modules/groups/service');
const groupsRepository = require('../../../modules/groups/repository');
const membersService = require('../../../modules/members/service');
const registrationService = require('../../../modules/auth/registrationService');
const passwordResetService = require('../../../modules/auth/passwordResetService');
const seatsService = require('../../../services/seatsService');
const { logError } = require('../../../services/logService');
const { Person, Role, User, UserGroup } = require('../../../models');
const { getConfig } = require('../../../config/config');
const { createTestUser } = require('../../helpers/testUtils');
const {
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} = require('../../../shared/errors');

const config = getConfig();
let counter = 0;
const newUser = (extra = {}) =>
    createTestUser({
        email: `gm-edge-${Date.now()}-${++counter}@example.com`,
        ...extra,
    });
const makeAdmin = (user) =>
    Role.update(
        { is_admin: true, role: 'admin' },
        { where: { user_id: user.id } }
    );

describe('groups service edge cases', () => {
    let admin;

    beforeEach(async () => {
        admin = await newUser();
        await Role.update({ is_admin: false }, { where: {} });
        await makeAdmin(admin);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        jest.restoreAllMocks();
    });

    it('offers no groups to a hosted caller without an account', async () => {
        config.hosted.enabled = true;
        expect(await groupsService.listForPicker(987654)).toEqual([]);
    });

    it('turns a name clash at write time into a conflict', async () => {
        const clash = new UniqueConstraintError({ errors: [] });
        jest.spyOn(groupsRepository, 'create').mockRejectedValue(clash);
        await expect(
            groupsService.create(admin.id, { name: `Race ${counter}` })
        ).rejects.toBeInstanceOf(ConflictError);

        const group = await UserGroup.create({ name: `Existing ${counter}` });
        jest.spyOn(groupsRepository, 'update').mockRejectedValue(clash);
        await expect(
            groupsService.update(admin.id, group.uid, {
                name: `Renamed ${counter}`,
            })
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('passes any other write failure on unchanged', async () => {
        const failure = new Error('disk full');
        jest.spyOn(groupsRepository, 'create').mockRejectedValue(failure);
        await expect(
            groupsService.create(admin.id, { name: `Full ${counter}` })
        ).rejects.toBe(failure);
    });

    it('updates a description without checking the name', async () => {
        const group = await UserGroup.create({ name: `Quiet ${counter}` });
        const check = jest.spyOn(groupsRepository, 'findByNameInsensitive');

        const result = await groupsService.update(admin.id, group.uid, {
            description: 'Just the kids',
        });

        expect(result.description).toBe('Just the kids');
        expect(check).not.toHaveBeenCalled();
    });

    it('finds a group and checks a name with their defaults', async () => {
        const group = await UserGroup.create({ name: `Default ${counter}` });
        expect((await groupsService._requireGroup(group.uid)).id).toBe(
            group.id
        );
        await expect(
            groupsService._assertNameAvailable(`default ${counter}`)
        ).rejects.toBeInstanceOf(ConflictError);
        await expect(
            groupsService._requireGroup('missing')
        ).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('members service edge cases', () => {
    let admin;

    beforeEach(async () => {
        admin = await newUser();
        await Role.update({ is_admin: false }, { where: {} });
        await makeAdmin(admin);
        logError.mockClear();
    });

    afterEach(() => {
        config.hosted.enabled = false;
        jest.restoreAllMocks();
    });

    it('will not let one admin change another here', async () => {
        const other = await newUser();
        await makeAdmin(other);
        await expect(
            membersService.updateMember(admin.id, other.id, { name: 'X' })
        ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('refuses to turn a contact without a name or email into a member', async () => {
        jest.spyOn(Person, 'findOne').mockResolvedValueOnce({
            id: 987654,
            uid: 'nameless',
            name: null,
            linked_user_id: null,
        });

        await expect(
            membersService.createMember(admin.id, { person_uid: 'nameless' })
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('names a one-word contact with no surname', async () => {
        const contact = await Person.create({
            name: `Solo${counter}`,
            user_id: admin.id,
        });

        const created = await membersService.createMember(admin.id, {
            person_uid: contact.uid,
        });

        expect(created.name).toBe(`Solo${counter}`);
        expect(created.surname ?? null).toBeNull();
    });

    it('refuses an empty request', async () => {
        await expect(
            membersService.createMember(admin.id)
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('reports no person when the new account has none', async () => {
        const realFindOne = Person.findOne.bind(Person);
        jest.spyOn(Person, 'findOne').mockImplementation(async (options) =>
            options?.where?.linked_user_id ? null : realFindOne(options)
        );

        const created = await membersService.createMember(admin.id, {
            name: 'Ghost',
        });

        expect(created.person_uid).toBeNull();
    });

    it('changes a surname and accepts an empty update', async () => {
        const member = await membersService.createMember(admin.id, {
            name: 'Kid',
        });

        const renamed = await membersService.updateMember(admin.id, member.id, {
            surname: 'Smith',
        });
        expect(renamed.surname).toBe('Smith');

        const same = await membersService.updateMember(admin.id, member.id);
        expect(same.surname).toBe('Smith');
    });

    it('reports an email that is already taken', async () => {
        const taken = await newUser();
        const member = await membersService.createMember(admin.id, {
            name: 'Kid',
        });
        jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(
            Object.assign(new Error('duplicate'), {
                name: 'SequelizeUniqueConstraintError',
            })
        );

        await expect(
            membersService.updateMember(admin.id, member.id, {
                email: taken.email,
            })
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('passes any other save failure on', async () => {
        const member = await membersService.createMember(admin.id, {
            name: 'Kid',
        });
        const failure = new Error('disk full');
        jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(failure);

        await expect(
            membersService.updateMember(admin.id, member.id, { name: 'New' })
        ).rejects.toBe(failure);
    });

    it('frees no seat when a self-hosted member is removed', async () => {
        const member = await membersService.createMember(admin.id, {
            name: 'Kid',
        });
        seatsService.reconcile.mockClear();

        await membersService.removeMember(admin.id, member.id);

        expect(await User.findByPk(member.id)).toBeNull();
        expect(seatsService.reconcile).not.toHaveBeenCalled();
    });

    it('keeps the account when the emails cannot be sent', async () => {
        jest.spyOn(
            registrationService,
            'resendVerificationEmail'
        ).mockRejectedValue(new Error('smtp down'));
        jest.spyOn(
            passwordResetService,
            'sendMemberInviteEmail'
        ).mockRejectedValue(new Error('smtp down'));

        expect(
            await membersService.sendEmails(
                { email: 'a@example.com' },
                { verify: true, invite: true }
            )
        ).toBe(false);
        expect(logError).toHaveBeenCalledTimes(2);
    });
});
