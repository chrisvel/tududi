import {
    acceptInvitation,
    declineInvitation,
    grantShare,
    listShareDetails,
    listShares,
    revokeGroupShare,
    revokeShare,
} from '../sharesService';
import { clearCsrfToken } from '../csrfService';

// jsdom has no Response constructor, so stub the parts fetch callers use
const jsonResponse = (status: number, body: unknown = {}) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as Response;

const fetchMock = () => global.fetch as jest.Mock;

const callsTo = (fragment: string) =>
    fetchMock().mock.calls.filter(([url]) => String(url).includes(fragment));

const lastBody = (fragment: string) => {
    const calls = callsTo(fragment);
    return JSON.parse(calls[calls.length - 1][1].body);
};

describe('sharesService', () => {
    beforeEach(() => {
        clearCsrfToken();
        global.fetch = jest.fn(async (url: string) =>
            String(url).includes('csrf-token')
                ? jsonResponse(200, { csrfToken: 'tok' })
                : jsonResponse(204)
        ) as jest.Mock;
    });

    afterEach(() => {
        clearCsrfToken();
        jest.restoreAllMocks();
    });

    describe('grantShare', () => {
        it('sends a user share by email', async () => {
            await grantShare({
                resource_type: 'project',
                resource_uid: 'p1',
                target_user_email: 'a@example.com',
                access_level: 'rw',
            });

            expect(lastBody('shares')).toEqual({
                resource_type: 'project',
                resource_uid: 'p1',
                target_user_email: 'a@example.com',
                access_level: 'rw',
            });
        });

        it('sends a group share by uid without an email', async () => {
            await grantShare({
                resource_type: 'area',
                resource_uid: 'a1',
                target_group_uid: 'g1',
                access_level: 'ro',
            });

            const body = lastBody('shares');
            expect(body.target_group_uid).toBe('g1');
            expect(body).not.toHaveProperty('target_user_email');
        });

        it('surfaces the server error message', async () => {
            global.fetch = jest.fn(async (url: string) =>
                String(url).includes('csrf-token')
                    ? jsonResponse(200, { csrfToken: 'tok' })
                    : jsonResponse(404, { error: 'Group not found' })
            ) as jest.Mock;

            await expect(
                grantShare({
                    resource_type: 'project',
                    resource_uid: 'p1',
                    target_group_uid: 'nope',
                    access_level: 'ro',
                })
            ).rejects.toThrow('Group not found');
        });
    });

    describe('listing shares', () => {
        const payload = {
            shares: [
                { user_id: 1, access_level: 'owner', is_owner: true },
                { user_id: 2, access_level: 'ro' },
            ],
            group_shares: [
                {
                    group_uid: 'g1',
                    group_name: 'Family',
                    access_level: 'rw',
                    member_count: 3,
                    accepted_count: 1,
                    pending_count: 2,
                    created_at: null,
                },
            ],
        };

        beforeEach(() => {
            global.fetch = jest.fn(async () =>
                jsonResponse(200, payload)
            ) as jest.Mock;
        });

        it('returns both users and groups', async () => {
            const details = await listShareDetails('project', 'p1');

            expect(details.shares).toHaveLength(2);
            expect(details.group_shares[0].group_name).toBe('Family');
            expect(String(fetchMock().mock.calls[0][0])).toContain(
                'resource_type=project&resource_uid=p1'
            );
        });

        it('keeps listShares returning only the direct rows', async () => {
            const rows = await listShares('project', 'p1');

            expect(rows.map((r) => r.user_id)).toEqual([1, 2]);
        });

        it('tolerates a server that predates groups', async () => {
            global.fetch = jest.fn(async () =>
                jsonResponse(200, { shares: [] })
            ) as jest.Mock;

            await expect(listShareDetails('project', 'p1')).resolves.toEqual({
                shares: [],
                group_shares: [],
            });
        });

        it('throws the server message when loading fails', async () => {
            global.fetch = jest.fn(async () =>
                jsonResponse(403, { error: 'Forbidden' })
            ) as jest.Mock;

            await expect(listShares('project', 'p1')).rejects.toThrow(
                'Forbidden'
            );
        });
    });

    describe('revoking', () => {
        it('revokes a user by id', async () => {
            await revokeShare('project', 'p1', 7);

            expect(lastBody('shares')).toEqual({
                resource_type: 'project',
                resource_uid: 'p1',
                target_user_id: 7,
            });
            const [, init] = callsTo('shares')[0];
            expect(init.method).toBe('DELETE');
        });

        it('revokes a group by uid', async () => {
            await revokeGroupShare('project', 'p1', 'g1');

            expect(lastBody('shares')).toEqual({
                resource_type: 'project',
                resource_uid: 'p1',
                target_group_uid: 'g1',
            });
        });

        it('reports a failed group revoke', async () => {
            global.fetch = jest.fn(async (url: string) =>
                String(url).includes('csrf-token')
                    ? jsonResponse(200, { csrfToken: 'tok' })
                    : jsonResponse(404, { error: 'Not shared with the group' })
            ) as jest.Mock;

            await expect(
                revokeGroupShare('project', 'p1', 'g1')
            ).rejects.toThrow('Not shared with the group');
        });
    });

    describe('answering invitations', () => {
        it('uses the numeric id of a direct share', async () => {
            await acceptInvitation(12);

            expect(String(callsTo('invitations')[0][0])).toContain(
                'shares/invitations/12/accept'
            );
        });

        it('passes a group invitation id through untouched', async () => {
            await acceptInvitation('g12');
            await declineInvitation('g12');

            const urls = callsTo('invitations').map(([url]) => String(url));
            expect(urls[0]).toContain('shares/invitations/g12/accept');
            expect(urls[1]).toContain('shares/invitations/g12/decline');
        });

        it('throws when the invitation is gone', async () => {
            global.fetch = jest.fn(async (url: string) =>
                String(url).includes('csrf-token')
                    ? jsonResponse(200, { csrfToken: 'tok' })
                    : jsonResponse(404, { error: 'Invitation not found' })
            ) as jest.Mock;

            await expect(acceptInvitation('g99')).rejects.toThrow(
                'Invitation not found'
            );
        });
    });
});
