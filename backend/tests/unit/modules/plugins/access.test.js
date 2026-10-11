jest.mock('../../../../services/rolesService', () => ({
    ...jest.requireActual('../../../../services/rolesService'),
    isAdmin: jest.fn(),
}));

jest.mock('../../../../services/entitlementsService', () => ({
    ...jest.requireActual('../../../../services/entitlementsService'),
    isHostedMode: jest.fn(),
}));

const { Role } = require('../../../../models');
const rolesService = require('../../../../services/rolesService');
const entitlements = require('../../../../services/entitlementsService');
const {
    canManagePlugins,
    requirePluginManager,
} = require('../../../../modules/plugins/access');

const user = { uid: 'user-uid-1' };

const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

describe('plugin manager access', () => {
    beforeEach(() => {
        rolesService.isAdmin.mockResolvedValue(false);
        entitlements.isHostedMode.mockReturnValue(false);
        // The roles table is empty, which is what a fresh instance looks like.
        jest.spyOn(Role, 'count').mockResolvedValue(0);
    });

    describe('canManagePlugins', () => {
        it('refuses a request with no user', async () => {
            expect(await canManagePlugins(null)).toBe(false);
            expect(await canManagePlugins({})).toBe(false);
        });

        it('allows an admin', async () => {
            rolesService.isAdmin.mockResolvedValue(true);

            expect(await canManagePlugins(user)).toBe(true);
        });

        it('allows the first user of an instance that has no roles yet', async () => {
            // Otherwise a fresh instance could not install anything at all:
            // nobody is an admin until an admin is appointed.
            expect(await canManagePlugins(user)).toBe(true);
            expect(Role.count).toHaveBeenCalled();
        });

        it('refuses a non-admin once the instance has roles', async () => {
            Role.count.mockResolvedValue(3);

            expect(await canManagePlugins(user)).toBe(false);
        });

        it('never bootstraps on a hosted instance', async () => {
            // An empty roles table there would hand plugin installation to
            // whoever asked first.
            entitlements.isHostedMode.mockReturnValue(true);

            expect(await canManagePlugins(user)).toBe(false);
        });
    });

    describe('requirePluginManager', () => {
        it('lets an admin through', async () => {
            rolesService.isAdmin.mockResolvedValue(true);
            const next = jest.fn();

            await requirePluginManager(
                { currentUser: user, headers: {} },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith();
        });

        it('answers 403 for a non-admin', async () => {
            Role.count.mockResolvedValue(1);
            const res = response();

            await requirePluginManager(
                { currentUser: user, headers: {} },
                res,
                jest.fn()
            );

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        });

        it('refuses a personal API token even when it belongs to an admin', async () => {
            rolesService.isAdmin.mockResolvedValue(true);
            const next = jest.fn();

            await requirePluginManager(
                {
                    currentUser: user,
                    authToken: { id: 1 },
                    headers: { authorization: 'Bearer abc' },
                },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 403 })
            );
            expect(String(next.mock.calls[0][0].message)).toMatch(
                /signed-in session/
            );
        });

        it('refuses an OIDC access token on the Authorization header', async () => {
            rolesService.isAdmin.mockResolvedValue(true);
            const next = jest.fn();

            await requirePluginManager(
                {
                    currentUser: user,
                    headers: { authorization: 'bearer abc' },
                },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 403 })
            );
        });

        it('passes a database failure to the error handler', async () => {
            rolesService.isAdmin.mockRejectedValue(new Error('db is down'));
            const next = jest.fn();

            await requirePluginManager(
                { currentUser: user, headers: {} },
                response(),
                next
            );

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'db is down' })
            );
        });
    });
});
