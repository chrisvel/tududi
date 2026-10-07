import React from 'react';
import {
    render,
    screen,
    waitFor,
    fireEvent,
    within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AdminGroupsPanel from '../AdminGroupsPanel';

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

const showSuccessToast = jest.fn();
const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showSuccessToast, showErrorToast }),
}));

const fetchAdminGroups = jest.fn();
const fetchAdminGroup = jest.fn();
const createAdminGroup = jest.fn();
const updateAdminGroup = jest.fn();
const deleteAdminGroup = jest.fn();
const addGroupMembers = jest.fn();
const removeGroupMember = jest.fn();
const fetchUserOptions = jest.fn();
jest.mock('../../../utils/groupsService', () => ({
    fetchAdminGroups: (...args: any[]) => fetchAdminGroups(...args),
    fetchAdminGroup: (...args: any[]) => fetchAdminGroup(...args),
    createAdminGroup: (...args: any[]) => createAdminGroup(...args),
    updateAdminGroup: (...args: any[]) => updateAdminGroup(...args),
    deleteAdminGroup: (...args: any[]) => deleteAdminGroup(...args),
    addGroupMembers: (...args: any[]) => addGroupMembers(...args),
    removeGroupMember: (...args: any[]) => removeGroupMember(...args),
    fetchUserOptions: (...args: any[]) => fetchUserOptions(...args),
}));

const group = (uid: string, name: string, members = 0, shares = 0) => ({
    uid,
    name,
    description: null,
    member_count: members,
    share_count: shares,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <AdminGroupsPanel />
        </MemoryRouter>
    );

describe('Admin groups panel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchAdminGroups.mockResolvedValue([
            group('g1', 'Family', 3, 2),
            group('g2', 'Work', 0, 0),
        ]);
        fetchAdminGroup.mockResolvedValue({
            group: group('g1', 'Family', 1, 0),
            members: [
                {
                    user_id: 10,
                    email: 'alice@example.com',
                    name: 'Alice',
                    surname: 'Smith',
                },
            ],
            shares: [
                {
                    resource_type: 'project',
                    resource_uid: 'p1',
                    resource_name: 'Kitchen',
                    access_level: 'rw',
                },
            ],
        });
        fetchUserOptions.mockResolvedValue([
            { id: 10, email: 'alice@example.com', name: 'Alice' },
            { id: 11, email: 'bob@example.com', name: 'Bob' },
            { id: 12, email: 'carol@example.com', name: 'Carol' },
        ]);
    });

    it('lists groups with their member and shared item counts', async () => {
        renderPage();

        const family = await screen.findByTestId('group-row-g1');
        expect(within(family).getByText('Family')).toBeInTheDocument();
        expect(within(family).getByText('3')).toBeInTheDocument();
        expect(within(family).getByText('2')).toBeInTheDocument();
        expect(screen.getByTestId('group-row-g2')).toBeInTheDocument();
    });

    it('explains how to start when there are no groups', async () => {
        fetchAdminGroups.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByTestId('groups-empty')).toHaveTextContent(
            'No groups yet'
        );
    });

    it('shows a load error', async () => {
        fetchAdminGroups.mockRejectedValue(new Error('Boom'));
        renderPage();

        expect(await screen.findByText('Boom')).toBeInTheDocument();
    });

    describe('creating a group', () => {
        const openModal = async () => {
            renderPage();
            await screen.findByTestId('group-row-g1');
            fireEvent.click(screen.getByTestId('add-group-button'));
            return screen.findByTestId('group-modal');
        };

        it('creates the group, reloads the list and opens its members', async () => {
            createAdminGroup.mockResolvedValue(group('g3', 'Friends'));
            const modal = await openModal();

            fireEvent.change(within(modal).getByLabelText('Name'), {
                target: { value: '  Friends  ' },
            });
            fireEvent.change(within(modal).getByLabelText('Description'), {
                target: { value: 'Weekend crew' },
            });
            fireEvent.click(within(modal).getByText('Save'));

            await waitFor(() =>
                expect(createAdminGroup).toHaveBeenCalledWith({
                    name: 'Friends',
                    description: 'Weekend crew',
                })
            );
            await waitFor(() =>
                expect(fetchAdminGroups).toHaveBeenCalledTimes(2)
            );
            expect(showSuccessToast).toHaveBeenCalledWith('Group created');
            expect(
                await screen.findByTestId('group-members-modal')
            ).toBeInTheDocument();
        });

        it('rejects a blank name without calling the server', async () => {
            const modal = await openModal();

            fireEvent.click(within(modal).getByText('Save'));

            expect(await within(modal).findByRole('alert')).toHaveTextContent(
                'Enter a group name'
            );
            expect(createAdminGroup).not.toHaveBeenCalled();
        });

        it('shows the server error and keeps the form open', async () => {
            createAdminGroup.mockRejectedValue(
                new Error('A group with this name already exists')
            );
            const modal = await openModal();

            fireEvent.change(within(modal).getByLabelText('Name'), {
                target: { value: 'Family' },
            });
            fireEvent.click(within(modal).getByText('Save'));

            expect(await within(modal).findByRole('alert')).toHaveTextContent(
                'A group with this name already exists'
            );
            expect(screen.getByTestId('group-modal')).toBeInTheDocument();
        });
    });

    describe('editing a group', () => {
        it('updates the name and description', async () => {
            updateAdminGroup.mockResolvedValue(group('g1', 'Household', 3, 2));
            renderPage();
            const row = await screen.findByTestId('group-row-g1');

            fireEvent.click(within(row).getByTitle('Edit'));
            const modal = await screen.findByTestId('group-modal');
            expect(within(modal).getByLabelText('Name')).toHaveValue('Family');

            fireEvent.change(within(modal).getByLabelText('Name'), {
                target: { value: 'Household' },
            });
            fireEvent.click(within(modal).getByText('Save'));

            await waitFor(() =>
                expect(updateAdminGroup).toHaveBeenCalledWith('g1', {
                    name: 'Household',
                    description: null,
                })
            );
            expect(showSuccessToast).toHaveBeenCalledWith('Group updated');
            expect(createAdminGroup).not.toHaveBeenCalled();
        });
    });

    describe('deleting a group', () => {
        it('asks for confirmation, deletes and tells the app collaborators changed', async () => {
            deleteAdminGroup.mockResolvedValue(undefined);
            const changed = jest.fn();
            window.addEventListener('collaboratorsChanged', changed);
            renderPage();
            const row = await screen.findByTestId('group-row-g1');

            fireEvent.click(within(row).getByTitle('Delete'));
            expect(deleteAdminGroup).not.toHaveBeenCalled();
            fireEvent.click(
                await screen.findByTestId('confirm-dialog-confirm')
            );

            await waitFor(() =>
                expect(deleteAdminGroup).toHaveBeenCalledWith('g1')
            );
            expect(showSuccessToast).toHaveBeenCalledWith('Group deleted');
            expect(changed).toHaveBeenCalled();
            window.removeEventListener('collaboratorsChanged', changed);
        });

        it('does nothing when cancelled', async () => {
            renderPage();
            const row = await screen.findByTestId('group-row-g1');

            fireEvent.click(within(row).getByTitle('Delete'));
            fireEvent.click(await screen.findByTestId('confirm-dialog-cancel'));

            expect(deleteAdminGroup).not.toHaveBeenCalled();
            expect(
                screen.queryByTestId('confirm-dialog-confirm')
            ).not.toBeInTheDocument();
        });

        it('reports a failed delete', async () => {
            deleteAdminGroup.mockRejectedValue(new Error('Nope'));
            renderPage();
            const row = await screen.findByTestId('group-row-g1');

            fireEvent.click(within(row).getByTitle('Delete'));
            fireEvent.click(
                await screen.findByTestId('confirm-dialog-confirm')
            );

            await waitFor(() =>
                expect(showErrorToast).toHaveBeenCalledWith('Nope')
            );
        });
    });

    describe('managing members', () => {
        const openMembers = async () => {
            renderPage();
            const row = await screen.findByTestId('group-row-g1');
            fireEvent.click(within(row).getByTitle('Manage members'));
            return screen.findByTestId('group-members-modal');
        };

        it('shows current members and what the group is shared with', async () => {
            const modal = await openMembers();

            expect(
                await within(modal).findByTestId('group-member-10')
            ).toHaveTextContent('alice@example.com');
            expect(within(modal).getByText(/Kitchen/)).toBeInTheDocument();
        });

        it('lists a member without an email by name', async () => {
            fetchAdminGroup.mockResolvedValue({
                group: group('g1', 'Family', 1, 0),
                members: [
                    { user_id: 13, email: null, name: 'Emma', surname: null },
                ],
                shares: [],
            });

            const modal = await openMembers();

            const row = await within(modal).findByTestId('group-member-13');
            expect(row).toHaveTextContent('Emma');
            expect(row).toHaveTextContent('No email');
        });

        it('finds a user without an email when searching', async () => {
            fetchUserOptions.mockResolvedValue([
                { id: 13, email: null, name: 'Emma' },
                { id: 11, email: 'bob@example.com', name: 'Bob' },
            ]);
            const modal = await openMembers();
            await within(modal).findByTestId('group-member-10');

            fireEvent.change(
                within(modal).getByPlaceholderText('Search by name or email'),
                { target: { value: 'em' } }
            );

            expect(
                await within(modal).findByTestId('group-add-member-13')
            ).toBeInTheDocument();
            expect(
                within(modal).queryByTestId('group-add-member-11')
            ).toBeNull();
        });

        it('only offers people who are not already members', async () => {
            const modal = await openMembers();
            await within(modal).findByTestId('group-member-10');

            expect(
                within(modal).queryByTestId('group-add-member-10')
            ).not.toBeInTheDocument();
            expect(
                within(modal).getByTestId('group-add-member-11')
            ).toBeInTheDocument();
            expect(
                within(modal).getByTestId('group-add-member-12')
            ).toBeInTheDocument();
        });

        it('filters the suggestions by search text', async () => {
            const modal = await openMembers();
            await within(modal).findByTestId('group-member-10');

            fireEvent.change(within(modal).getByLabelText('Add members'), {
                target: { value: 'carol' },
            });

            expect(
                within(modal).queryByTestId('group-add-member-11')
            ).not.toBeInTheDocument();
            expect(
                within(modal).getByTestId('group-add-member-12')
            ).toBeInTheDocument();
        });

        it('adds a member and refreshes the group', async () => {
            addGroupMembers.mockResolvedValue({
                added: [11],
                already_members: [],
            });
            const modal = await openMembers();
            await within(modal).findByTestId('group-member-10');

            fireEvent.click(within(modal).getByTestId('group-add-member-11'));

            await waitFor(() =>
                expect(addGroupMembers).toHaveBeenCalledWith('g1', [11])
            );
            expect(showSuccessToast).toHaveBeenCalledWith(
                'Bob added to the group'
            );
            // Initial load plus the refresh after adding.
            await waitFor(() =>
                expect(fetchAdminGroup).toHaveBeenCalledTimes(2)
            );
        });

        it('removes a member', async () => {
            removeGroupMember.mockResolvedValue(undefined);
            const modal = await openMembers();
            const member = await within(modal).findByTestId('group-member-10');

            fireEvent.click(within(member).getByText('Remove'));

            await waitFor(() =>
                expect(removeGroupMember).toHaveBeenCalledWith('g1', 10)
            );
            expect(showSuccessToast).toHaveBeenCalledWith(
                'Alice Smith removed from the group'
            );
        });

        it('reports a failed add without closing', async () => {
            addGroupMembers.mockRejectedValue(new Error('Nope'));
            const modal = await openMembers();
            await within(modal).findByTestId('group-member-10');

            fireEvent.click(within(modal).getByTestId('group-add-member-11'));

            await waitFor(() =>
                expect(showErrorToast).toHaveBeenCalledWith('Nope')
            );
            expect(
                screen.getByTestId('group-members-modal')
            ).toBeInTheDocument();
        });
    });
});
