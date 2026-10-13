jest.mock('bcrypt', () => ({
    hash: jest.fn(async () => 'hash'),
    compare: jest.fn(),
}));

const bcrypt = require('bcrypt');
const {
    ApiToken,
    Permission,
    GroupPermission,
    sequelize,
} = require('../../../models');
const apiTokenService = require('../../../modules/users/apiTokenService');
const { destroyUserSessions } = require('../../../services/sessionService');
const { applyPerms } = require('../../../services/applyPerms');
const permissionSources = require('../../../services/permissionSources');

// Small branches of the helpers every access check leans on: API token
// lookups and their cache, signing out everywhere, writing share rows, and
// ranking access levels from several sources.

afterEach(() => {
    jest.restoreAllMocks();
});

describe('apiTokenService', () => {
    beforeEach(() => {
        apiTokenService.clearVerifiedTokenCache();
    });

    it('serializes nothing as null', () => {
        expect(apiTokenService.serializeApiToken(null)).toBeNull();
    });

    it('finds nothing for an empty token', async () => {
        const findAll = jest.spyOn(ApiToken, 'findAll');
        expect(await apiTokenService.findValidTokenByValue('')).toBeNull();
        expect(findAll).not.toHaveBeenCalled();
    });

    it('skips tokens with the same prefix whose hash does not match', async () => {
        jest.spyOn(ApiToken, 'findAll').mockResolvedValue([
            { id: 1, token_hash: 'a' },
            { id: 2, token_hash: 'b' },
        ]);
        bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        const token = await apiTokenService.findValidTokenByValue('tt_abcdef');

        expect(token.id).toBe(2);
        expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('forgets the oldest verified token once the cache is full', async () => {
        jest.spyOn(ApiToken, 'findAll').mockImplementation(async () => [
            { id: 1, token_hash: 'x' },
        ]);
        bcrypt.compare.mockResolvedValue(true);

        for (let i = 0; i <= 5000; i += 1) {
            await apiTokenService.findValidTokenByValue(`tt_token${i}`);
        }
        const findByPk = jest
            .spyOn(ApiToken, 'findByPk')
            .mockResolvedValue({ id: 1 });

        // The first token was pushed out, so it is checked against the
        // database again instead of the cache.
        ApiToken.findAll.mockClear();
        await apiTokenService.findValidTokenByValue('tt_token0');
        expect(ApiToken.findAll).toHaveBeenCalled();

        // The last one is still cached.
        ApiToken.findAll.mockClear();
        await apiTokenService.findValidTokenByValue('tt_token5000');
        expect(findByPk).toHaveBeenCalled();
        expect(ApiToken.findAll).not.toHaveBeenCalled();
    });

    it('leaves an already revoked token as it was', async () => {
        const revokedAt = new Date('2026-01-01');
        const save = jest.fn();
        jest.spyOn(ApiToken, 'findOne').mockResolvedValue({
            id: 3,
            revoked_at: revokedAt,
            save,
        });

        const token = await apiTokenService.revokeApiToken(3, 1);

        expect(token.revoked_at).toBe(revokedAt);
        expect(save).not.toHaveBeenCalled();
    });
});

describe('destroyUserSessions', () => {
    it('signs out nothing when there is no session store', async () => {
        const saved = sequelize.models.Session;
        delete sequelize.models.Session;
        try {
            expect(await destroyUserSessions(1)).toBe(0);
        } finally {
            if (saved) sequelize.models.Session = saved;
        }
    });

    it('reports nothing signed out when the store fails', async () => {
        const saved = sequelize.models.Session;
        sequelize.models.Session = {
            destroy: jest.fn().mockRejectedValue(new Error('locked')),
        };
        jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await destroyUserSessions(1)).toBe(0);
        } finally {
            if (saved) sequelize.models.Session = saved;
            else delete sequelize.models.Session;
        }
    });
});

describe('applyPerms', () => {
    const tx = { LOCK: { UPDATE: 'UPDATE' } };

    it('does nothing without upserts or deletes', async () => {
        const findOne = jest.spyOn(Permission, 'findOne');
        await applyPerms(tx, {});
        expect(findOne).not.toHaveBeenCalled();
    });

    it.each([
        ['ro', 'none', 'ro'],
        ['none', 'ro', 'ro'],
        ['none', 'none', 'none'],
        ['ro', 'rw', 'rw'],
    ])(
        'keeps the higher of %s and %s on an existing share',
        async (existingLevel, newLevel, expected) => {
            const update = jest.fn();
            jest.spyOn(Permission, 'findOne').mockResolvedValue({
                access_level: existingLevel,
                status: 'pending',
                propagation: 'direct',
                source_action_id: null,
                update,
            });

            await applyPerms(tx, {
                upserts: [
                    {
                        userId: 1,
                        resourceType: 'project',
                        resourceUid: 'p',
                        accessLevel: newLevel,
                        grantedByUserId: 2,
                    },
                ],
            });

            expect(update).toHaveBeenCalledWith(
                expect.objectContaining({
                    access_level: expected,
                    status: 'accepted',
                    source_action_id: null,
                }),
                { transaction: tx }
            );
        }
    );

    it('keeps a pending share pending when asked to', async () => {
        const update = jest.fn();
        jest.spyOn(Permission, 'findOne').mockResolvedValue({
            access_level: 'ro',
            status: 'pending',
            propagation: 'direct',
            source_action_id: 7,
            update,
        });

        await applyPerms(tx, {
            upserts: [
                {
                    userId: 1,
                    resourceType: 'project',
                    resourceUid: 'p',
                    accessLevel: 'ro',
                    status: 'pending',
                    propagation: 'inherited',
                    grantedByUserId: 2,
                },
            ],
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'pending',
                propagation: 'inherited',
                source_action_id: 7,
            }),
            { transaction: tx }
        );
    });
});

describe('permissionSources.findAcceptedAccessLevel', () => {
    it('ranks a level it does not know below every known one', async () => {
        jest.spyOn(Permission, 'findOne').mockResolvedValue({
            access_level: 'mystery',
        });
        jest.spyOn(GroupPermission, 'findAll').mockResolvedValue([
            { access_level: 'ro' },
        ]);

        expect(
            await permissionSources.findAcceptedAccessLevel(1, 'project', 'p')
        ).toBe('ro');
    });
});
