import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareModal from '../ShareModal';
import {
    failedShareCache,
    projectShareCache,
} from '../../../utils/projectShareCache';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, vars?: any) => {
            const template = typeof fallback === 'string' ? fallback : key;
            if (!vars) return template;
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

jest.mock('../../../utils/userUtils', () => ({
    getCurrentUser: () => ({ email: 'me@example.com' }),
}));

const grantShare = jest.fn();
const listShareDetails = jest.fn();
const revokeShare = jest.fn();
const revokeGroupShare = jest.fn();
jest.mock('../../../utils/sharesService', () => ({
    grantShare: (...args: any[]) => grantShare(...args),
    listShareDetails: (...args: any[]) => listShareDetails(...args),
    revokeShare: (...args: any[]) => revokeShare(...args),
    revokeGroupShare: (...args: any[]) => revokeGroupShare(...args),
}));

const fetchGroups = jest.fn();
jest.mock('../../../utils/groupsService', () => ({
    fetchGroups: (...args: any[]) => fetchGroups(...args),
}));

const owner = {
    user_id: 1,
    access_level: 'owner',
    status: 'accepted',
    created_at: null,
    email: 'me@example.com',
    is_owner: true,
};

const renderModal = (resourceType: 'project' | 'note' = 'project') =>
    render(
        <ShareModal
            isOpen
            onClose={jest.fn()}
            resourceType={resourceType}
            resourceUid="res-1"
            resourceName="Kitchen"
        />
    );

const emptyDetails = { shares: [owner], group_shares: [] };

describe('ShareModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        projectShareCache.clear();
        failedShareCache.clear();
        listShareDetails.mockResolvedValue(emptyDetails);
        fetchGroups.mockResolvedValue([]);
        grantShare.mockResolvedValue(undefined);
        revokeShare.mockResolvedValue(undefined);
        revokeGroupShare.mockResolvedValue(undefined);
    });

    describe('when the instance has no groups', () => {
        it('offers only the email form', async () => {
            renderModal();
            await waitFor(() => expect(fetchGroups).toHaveBeenCalled());

            expect(
                screen.getByLabelText('Invite by email')
            ).toBeInTheDocument();
            expect(
                screen.queryByTestId('share-target-group')
            ).not.toBeInTheDocument();
        });

        it('still shares with a user by email', async () => {
            renderModal();
            await waitFor(() => expect(fetchGroups).toHaveBeenCalled());

            fireEvent.change(screen.getByLabelText('Invite by email'), {
                target: { value: ' Friend@Example.com ' },
            });
            fireEvent.click(screen.getByText('Share'));

            await waitFor(() =>
                expect(grantShare).toHaveBeenCalledWith({
                    resource_type: 'project',
                    resource_uid: 'res-1',
                    target_user_email: 'friend@example.com',
                    access_level: 'ro',
                })
            );
            expect(
                await screen.findByText('Invitation sent.')
            ).toBeInTheDocument();
        });

        it('refuses to share with yourself', async () => {
            renderModal();
            await waitFor(() => expect(fetchGroups).toHaveBeenCalled());

            fireEvent.change(screen.getByLabelText('Invite by email'), {
                target: { value: 'me@example.com' },
            });
            fireEvent.click(screen.getByText('Share'));

            expect(
                await screen.findByText('You already have full access to this')
            ).toBeInTheDocument();
            expect(grantShare).not.toHaveBeenCalled();
        });
    });

    describe('when the instance has groups', () => {
        beforeEach(() => {
            fetchGroups.mockResolvedValue([
                { uid: 'g1', name: 'Family', member_count: 3 },
                { uid: 'g2', name: 'Work', member_count: 5 },
            ]);
        });

        const openGroupTab = async () => {
            renderModal();
            fireEvent.click(await screen.findByTestId('share-target-group'));
        };

        it('shows a User and Group toggle that defaults to user', async () => {
            renderModal();
            expect(
                await screen.findByTestId('share-target-user')
            ).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByTestId('share-target-group')).toHaveAttribute(
                'aria-selected',
                'false'
            );
        });

        it('lists the groups with their sizes', async () => {
            await openGroupTab();

            expect(
                screen.getByRole('option', { name: 'Family (3)' })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('option', { name: 'Work (5)' })
            ).toBeInTheDocument();
        });

        it('shares with the chosen group at the chosen level', async () => {
            await openGroupTab();

            fireEvent.change(screen.getByLabelText('Share with a group'), {
                target: { value: 'g2' },
            });
            fireEvent.change(screen.getByDisplayValue('Read only'), {
                target: { value: 'rw' },
            });
            fireEvent.click(screen.getByText('Share'));

            await waitFor(() =>
                expect(grantShare).toHaveBeenCalledWith({
                    resource_type: 'project',
                    resource_uid: 'res-1',
                    target_group_uid: 'g2',
                    access_level: 'rw',
                })
            );
            expect(
                await screen.findByText(
                    'Invitations sent to the group members.'
                )
            ).toBeInTheDocument();
        });

        it('cannot submit until a group is chosen', async () => {
            await openGroupTab();

            expect(screen.getByText('Share')).toBeDisabled();
            fireEvent.change(screen.getByLabelText('Share with a group'), {
                target: { value: 'g1' },
            });
            expect(screen.getByText('Share')).toBeEnabled();
        });

        it('disables groups the resource is already shared with', async () => {
            listShareDetails.mockResolvedValue({
                shares: [owner],
                group_shares: [
                    {
                        group_uid: 'g1',
                        group_name: 'Family',
                        access_level: 'ro',
                        member_count: 3,
                        accepted_count: 1,
                        pending_count: 2,
                        created_at: '2026-09-01T00:00:00.000Z',
                    },
                ],
            });
            await openGroupTab();

            expect(
                await screen.findByRole('option', {
                    name: 'Family (3) - already shared',
                })
            ).toBeDisabled();
            expect(
                screen.getByRole('option', { name: 'Work (5)' })
            ).toBeEnabled();
        });

        it('shows a server error from sharing with a group', async () => {
            grantShare.mockRejectedValue(new Error('Group not found'));
            await openGroupTab();

            fireEvent.change(screen.getByLabelText('Share with a group'), {
                target: { value: 'g1' },
            });
            fireEvent.click(screen.getByText('Share'));

            expect(
                await screen.findByText('Group not found')
            ).toBeInTheDocument();
        });

        it('switching back to the user tab restores the email form', async () => {
            await openGroupTab();
            fireEvent.click(screen.getByTestId('share-target-user'));

            expect(
                screen.getByLabelText('Invite by email')
            ).toBeInTheDocument();
            expect(
                screen.queryByLabelText('Share with a group')
            ).not.toBeInTheDocument();
        });
    });

    describe('groups the resource is shared with', () => {
        const sharedWithFamily = {
            shares: [owner],
            group_shares: [
                {
                    group_uid: 'g1',
                    group_name: 'Family',
                    access_level: 'rw',
                    member_count: 3,
                    accepted_count: 1,
                    pending_count: 2,
                    created_at: '2026-09-01T00:00:00.000Z',
                },
            ],
        };

        it('lists each group with its access level and answer counts', async () => {
            listShareDetails.mockResolvedValue(sharedWithFamily);
            renderModal();

            const list = await screen.findByTestId('share-group-list');
            expect(list).toHaveTextContent('Family');
            expect(list).toHaveTextContent('Read & write');
            expect(list).toHaveTextContent('1 accepted, 2 pending');
        });

        it('is absent when nothing is shared with a group', async () => {
            renderModal();
            await waitFor(() => expect(listShareDetails).toHaveBeenCalled());

            expect(
                screen.queryByTestId('share-group-list')
            ).not.toBeInTheDocument();
        });

        it('revokes a group, refreshes, and clears the project card cache', async () => {
            listShareDetails
                .mockResolvedValueOnce(sharedWithFamily)
                .mockResolvedValue(emptyDetails);
            projectShareCache.set('res-1', []);
            failedShareCache.add('res-1');
            const changed = jest.fn();
            window.addEventListener('collaboratorsChanged', changed);
            renderModal();

            fireEvent.click(await screen.findByTestId('share-group-revoke-g1'));

            await waitFor(() =>
                expect(revokeGroupShare).toHaveBeenCalledWith(
                    'project',
                    'res-1',
                    'g1'
                )
            );
            await waitFor(() =>
                expect(
                    screen.queryByTestId('share-group-list')
                ).not.toBeInTheDocument()
            );
            expect(changed).toHaveBeenCalled();
            expect(projectShareCache.has('res-1')).toBe(false);
            expect(failedShareCache.has('res-1')).toBe(false);
            window.removeEventListener('collaboratorsChanged', changed);
        });

        it('leaves the project cache alone for other resource types', async () => {
            listShareDetails.mockResolvedValueOnce(sharedWithFamily);
            projectShareCache.set('res-1', []);
            renderModal('note');

            fireEvent.click(await screen.findByTestId('share-group-revoke-g1'));

            await waitFor(() => expect(revokeGroupShare).toHaveBeenCalled());
            expect(projectShareCache.has('res-1')).toBe(true);
        });

        it('shows why a revoke failed', async () => {
            listShareDetails.mockResolvedValue(sharedWithFamily);
            revokeGroupShare.mockRejectedValue(new Error('Forbidden'));
            renderModal();

            fireEvent.click(await screen.findByTestId('share-group-revoke-g1'));

            expect(await screen.findByText('Forbidden')).toBeInTheDocument();
        });
    });

    it('revokes a directly invited user as before', async () => {
        listShareDetails.mockResolvedValueOnce({
            shares: [
                owner,
                {
                    user_id: 7,
                    access_level: 'ro',
                    status: 'accepted',
                    created_at: '2026-09-01T00:00:00.000Z',
                    email: 'pal@example.com',
                },
            ],
            group_shares: [],
        });
        renderModal();

        fireEvent.click(await screen.findByText('Revoke'));

        await waitFor(() =>
            expect(revokeShare).toHaveBeenCalledWith('project', 'res-1', 7)
        );
        expect(revokeGroupShare).not.toHaveBeenCalled();
    });
});
