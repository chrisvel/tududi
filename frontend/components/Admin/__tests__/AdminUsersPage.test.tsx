import React from 'react';
import { webcrypto } from 'crypto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminUsersPage from '../AdminUsersPage';
import { fetchWithCsrf } from '../../../utils/csrfService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/csrfService', () => ({
    fetchWithCsrf: jest.fn(),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/groupsService', () => ({
    fetchAdminGroups: jest.fn().mockResolvedValue([]),
    fetchAdminGroup: jest.fn(),
    createAdminGroup: jest.fn(),
    updateAdminGroup: jest.fn(),
    deleteAdminGroup: jest.fn(),
    addGroupMembers: jest.fn(),
    removeGroupMember: jest.fn(),
    fetchUserOptions: jest.fn().mockResolvedValue([]),
}));

if (!(global as any).crypto?.getRandomValues) {
    Object.defineProperty(global, 'crypto', {
        value: webcrypto,
        configurable: true,
    });
}

const rolesOverview = {
    capabilities: ['create_people', 'invite_members', 'create_projects'],
    roles: [
        {
            id: 'admin',
            member_count: 1,
            capabilities: {
                create_people: true,
                invite_members: true,
                create_projects: true,
            },
        },
        {
            id: 'user',
            member_count: 2,
            capabilities: {
                create_people: true,
                invite_members: false,
                create_projects: true,
            },
        },
        {
            id: 'guest',
            member_count: 1,
            capabilities: {
                create_people: false,
                invite_members: false,
                create_projects: false,
            },
        },
    ],
};

const jsonResponse = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
});

// Answers each admin endpoint the page calls.
const mockAdminApi = (
    users: unknown[] = [],
    roles: unknown = rolesOverview,
    rolesStatus = 200
) => {
    (global as any).fetch = jest.fn().mockImplementation((url: string) => {
        if (String(url).includes('admin/roles')) {
            return Promise.resolve(jsonResponse(roles, rolesStatus));
        }
        return Promise.resolve(jsonResponse(users));
    });
};

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.search}</div>;
};

const renderPage = (initialEntry = '/admin/users') =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AdminUsersPage />
            <LocationProbe />
        </MemoryRouter>
    );

describe('Admin users and groups page', () => {
    beforeEach(() => {
        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        });
    });

    it('opens on the Users tab by default', async () => {
        renderPage();

        expect(await screen.findByTestId('admin-users-panel')).toBeVisible();
        expect(screen.queryByTestId('admin-groups-panel')).toBeNull();
        expect(screen.getByTestId('admin-tab-users')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByTestId('admin-tab-groups')).toHaveAttribute(
            'aria-selected',
            'false'
        );
    });

    it('opens on the Groups tab from the URL', async () => {
        renderPage('/admin/users?tab=groups');

        expect(await screen.findByTestId('admin-groups-panel')).toBeVisible();
        expect(screen.queryByTestId('admin-users-panel')).toBeNull();
        expect(screen.getByTestId('admin-tab-groups')).toHaveAttribute(
            'aria-selected',
            'true'
        );
    });

    it('falls back to Users for an unknown tab value', async () => {
        renderPage('/admin/users?tab=nope');

        expect(await screen.findByTestId('admin-users-panel')).toBeVisible();
    });

    it('switches tabs and keeps the choice in the URL', async () => {
        renderPage();
        await screen.findByTestId('admin-users-panel');

        fireEvent.click(screen.getByTestId('admin-tab-groups'));
        expect(await screen.findByTestId('admin-groups-panel')).toBeVisible();
        expect(screen.getByTestId('location')).toHaveTextContent('?tab=groups');

        fireEvent.click(screen.getByTestId('admin-tab-users'));
        expect(await screen.findByTestId('admin-users-panel')).toBeVisible();
        expect(screen.getByTestId('location').textContent).toBe('');
    });

    it('no longer shows the global registration toggle', async () => {
        renderPage();
        await screen.findByTestId('admin-users-panel');

        expect(screen.queryByText('User Registration')).toBeNull();
    });

    describe('add user form', () => {
        beforeEach(() => {
            (fetchWithCsrf as jest.Mock).mockReset();
        });

        const openAddForm = async () => {
            renderPage();
            await screen.findByTestId('admin-users-panel');
            fireEvent.click(screen.getByText('Add user'));
            return await screen.findByTestId('require-verification-switch');
        };

        it('keeps the verification switch off until a password is typed', async () => {
            const toggle = await openAddForm();
            expect(toggle).toBeDisabled();
            expect(toggle).toHaveAttribute('aria-checked', 'false');

            fireEvent.change(screen.getByTestId('admin-user-password'), {
                target: { value: 'password123' },
            });
            expect(toggle).toBeEnabled();
        });

        it('generates a policy-compliant password and reveals it', async () => {
            const toggle = await openAddForm();
            const input = screen.getByTestId(
                'admin-user-password'
            ) as HTMLInputElement;
            expect(input.type).toBe('password');
            expect(toggle).toBeDisabled();

            fireEvent.click(screen.getByTestId('generate-password'));

            expect(input.value.length).toBeGreaterThanOrEqual(8);
            expect(input.type).toBe('text');
            expect(toggle).toBeEnabled();
        });

        it('lets the admin hide and show the password', async () => {
            await openAddForm();
            const input = screen.getByTestId(
                'admin-user-password'
            ) as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'password123' } });

            fireEvent.click(screen.getByTestId('toggle-password-visibility'));
            expect(input.type).toBe('text');
            fireEvent.click(screen.getByTestId('toggle-password-visibility'));
            expect(input.type).toBe('password');
        });

        it('copies the password to the clipboard', async () => {
            const writeText = jest.fn().mockResolvedValue(undefined);
            Object.assign(navigator, { clipboard: { writeText } });
            await openAddForm();

            expect(screen.getByTestId('copy-password')).toBeDisabled();
            fireEvent.click(screen.getByTestId('generate-password'));
            const generated = (
                screen.getByTestId('admin-user-password') as HTMLInputElement
            ).value;
            fireEvent.click(screen.getByTestId('copy-password'));

            await waitFor(() =>
                expect(writeText).toHaveBeenCalledWith(generated)
            );
        });

        it('sends the generated password when the form is submitted', async () => {
            (fetchWithCsrf as jest.Mock).mockResolvedValue({
                ok: true,
                status: 201,
                json: async () => ({
                    id: 10,
                    email: 'gen@example.com',
                    created_at: new Date().toISOString(),
                    role: 'user',
                }),
            });
            await openAddForm();
            fireEvent.change(
                document.querySelector('input[type="email"]') as Element,
                { target: { value: 'gen@example.com' } }
            );
            fireEvent.click(screen.getByTestId('generate-password'));
            const generated = (
                screen.getByTestId('admin-user-password') as HTMLInputElement
            ).value;
            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalled());
            const body = JSON.parse(
                (fetchWithCsrf as jest.Mock).mock.calls[0][1].body
            );
            expect(body.password).toBe(generated);
        });

        it('sends require_verification when the switch is on', async () => {
            (fetchWithCsrf as jest.Mock).mockResolvedValue({
                ok: true,
                status: 201,
                json: async () => ({
                    id: 9,
                    email: 'new@example.com',
                    created_at: new Date().toISOString(),
                    role: 'user',
                    verification_requested: true,
                    email_sent: true,
                }),
            });
            const toggle = await openAddForm();

            fireEvent.change(
                document.querySelector('input[type="email"]') as Element,
                { target: { value: 'new@example.com' } }
            );
            fireEvent.change(screen.getByTestId('admin-user-password'), {
                target: { value: 'password123' },
            });
            fireEvent.click(toggle);
            expect(toggle).toHaveAttribute('aria-checked', 'true');
            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalled());
            const body = JSON.parse(
                (fetchWithCsrf as jest.Mock).mock.calls[0][1].body
            );
            expect(body.require_verification).toBe(true);
            expect(body.password).toBe('password123');
        });

        it('does not offer the switch when editing a user', async () => {
            (global as any).fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => [
                    {
                        id: 3,
                        email: 'a@example.com',
                        created_at: new Date().toISOString(),
                        role: 'user',
                    },
                ],
            });
            renderPage();
            fireEvent.click(await screen.findByTitle('Edit'));

            expect(await screen.findByText('Edit user')).toBeVisible();
            expect(
                screen.queryByTestId('require-verification-switch')
            ).toBeNull();
        });
    });

    describe('roles tab', () => {
        it('opens from the URL and lists the three roles', async () => {
            mockAdminApi();
            renderPage('/admin/users?tab=roles');

            expect(
                await screen.findByTestId('admin-roles-panel')
            ).toBeVisible();
            expect(screen.queryByTestId('admin-users-panel')).toBeNull();
            expect(screen.getByTestId('admin-tab-roles')).toHaveAttribute(
                'aria-selected',
                'true'
            );
            expect(
                await screen.findByTestId('role-column-admin')
            ).toHaveTextContent('Admin');
            expect(screen.getByTestId('role-column-user')).toHaveTextContent(
                'User'
            );
            expect(screen.getByTestId('role-column-guest')).toHaveTextContent(
                'Guest'
            );
        });

        it('shows how many accounts hold each role', async () => {
            mockAdminApi();
            renderPage('/admin/users?tab=roles');

            expect(
                await screen.findByTestId('role-members-user')
            ).toHaveAttribute('data-count', '2');
            expect(screen.getByTestId('role-members-admin')).toHaveAttribute(
                'data-count',
                '1'
            );
            expect(screen.getByTestId('role-members-guest')).toHaveAttribute(
                'data-count',
                '1'
            );
        });

        it('shows what each role is allowed to do', async () => {
            mockAdminApi();
            renderPage('/admin/users?tab=roles');

            await screen.findByTestId('role-column-admin');
            const allowed = (capability: string, role: string) =>
                screen
                    .getByTestId(`role-cell-${capability}-${role}`)
                    .querySelector('[data-allowed]')
                    ?.getAttribute('data-allowed');

            expect(allowed('invite_members', 'admin')).toBe('true');
            expect(allowed('invite_members', 'user')).toBe('false');
            expect(allowed('create_projects', 'user')).toBe('true');
            expect(allowed('create_people', 'guest')).toBe('false');
            expect(allowed('create_projects', 'guest')).toBe('false');
        });

        it('says only admins manage users, roles and groups', async () => {
            mockAdminApi();
            renderPage('/admin/users?tab=roles');

            const row = await screen.findByTestId('role-row-manage_accounts');
            const marks = Array.from(
                row.querySelectorAll('[data-allowed]')
            ).map((el) => el.getAttribute('data-allowed'));
            expect(marks).toEqual(['true', 'false', 'false']);
        });

        it('switches to the roles tab and keeps the choice in the URL', async () => {
            mockAdminApi();
            renderPage();
            await screen.findByTestId('admin-users-panel');

            fireEvent.click(screen.getByTestId('admin-tab-roles'));

            expect(
                await screen.findByTestId('admin-roles-panel')
            ).toBeVisible();
            expect(screen.getByTestId('location')).toHaveTextContent(
                '?tab=roles'
            );
        });

        it('says so when the roles cannot be loaded', async () => {
            mockAdminApi([], { error: 'nope' }, 403);
            renderPage('/admin/users?tab=roles');

            expect(await screen.findByRole('alert')).toBeVisible();
        });
    });

    describe('page heading', () => {
        it('is called Access and offers Users, Groups and Roles', async () => {
            mockAdminApi();
            renderPage();

            expect(
                await screen.findByRole('heading', { name: 'Access' })
            ).toBeVisible();
            expect(screen.getByTestId('admin-tab-users')).toHaveTextContent(
                'Users'
            );
            expect(screen.getByTestId('admin-tab-groups')).toHaveTextContent(
                'Groups'
            );
            expect(screen.getByTestId('admin-tab-roles')).toHaveTextContent(
                'Roles'
            );
        });
    });

    describe('roles in the user list and form', () => {
        beforeEach(() => {
            (fetchWithCsrf as jest.Mock).mockReset();
        });

        const account = (id: number, email: string, role: string) => ({
            id,
            email,
            created_at: new Date().toISOString(),
            role,
            capabilities: {
                create_people: role !== 'guest',
                invite_members: role === 'admin',
                create_projects: role !== 'guest',
            },
        });

        it('shows each account with its role', async () => {
            mockAdminApi([
                account(1, 'boss@example.com', 'admin'),
                account(2, 'kid@example.com', 'user'),
                account(3, 'plumber@example.com', 'guest'),
            ]);
            renderPage();

            expect(await screen.findByTestId('user-role-1')).toHaveTextContent(
                'Admin'
            );
            expect(screen.getByTestId('user-role-2')).toHaveTextContent('User');
            expect(screen.getByTestId('user-role-3')).toHaveTextContent(
                'Guest'
            );
        });

        const openAddForm = async () => {
            mockAdminApi();
            renderPage();
            await screen.findByTestId('admin-users-panel');
            fireEvent.click(screen.getByText('Add user'));
            return await screen.findByTestId('permissions-section');
        };

        it('starts a new account as a user who cannot invite', async () => {
            await openAddForm();

            expect(
                screen.getByTestId('capability-switch-create_people')
            ).toHaveAttribute('aria-checked', 'true');
            expect(
                screen.getByTestId('capability-switch-invite_members')
            ).toHaveAttribute('aria-checked', 'false');
            expect(
                screen.getByTestId('capability-switch-create_projects')
            ).toHaveAttribute('aria-checked', 'true');
        });

        it('offers all three roles', async () => {
            await openAddForm();

            fireEvent.click(screen.getByText('User', { selector: 'span' }));

            expect(
                await screen.findByTestId('role-option-admin')
            ).toBeVisible();
            expect(screen.getByTestId('role-option-user')).toBeVisible();
            expect(screen.getByTestId('role-option-guest')).toBeVisible();
        });

        it('resets the switches to the guest defaults when Guest is picked', async () => {
            await openAddForm();
            fireEvent.click(screen.getByText('User', { selector: 'span' }));

            fireEvent.click(await screen.findByTestId('role-option-guest'));

            for (const capability of [
                'create_people',
                'invite_members',
                'create_projects',
            ]) {
                expect(
                    screen.getByTestId(`capability-switch-${capability}`)
                ).toHaveAttribute('aria-checked', 'false');
            }
        });

        it('shows every permission on and locked for an admin', async () => {
            await openAddForm();
            fireEvent.click(screen.getByText('User', { selector: 'span' }));

            fireEvent.click(await screen.findByTestId('role-option-admin'));

            const invite = screen.getByTestId(
                'capability-switch-invite_members'
            );
            expect(invite).toHaveAttribute('aria-checked', 'true');
            expect(invite).toBeDisabled();
            expect(screen.getByText('Admins can do everything.')).toBeVisible();
        });

        it('sends the role and permissions when a user is allowed to invite', async () => {
            (fetchWithCsrf as jest.Mock).mockResolvedValue(
                jsonResponse(account(9, 'helper@example.com', 'user'), 201)
            );
            await openAddForm();
            fireEvent.change(
                document.querySelector('input[type="email"]') as Element,
                { target: { value: 'helper@example.com' } }
            );

            fireEvent.click(
                screen.getByTestId('capability-switch-invite_members')
            );
            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalled());
            const body = JSON.parse(
                (fetchWithCsrf as jest.Mock).mock.calls[0][1].body
            );
            expect(body.role).toBe('user');
            expect(body.capabilities).toEqual({
                create_people: true,
                invite_members: true,
                create_projects: true,
            });
        });

        it('sends the guest role with nothing allowed', async () => {
            (fetchWithCsrf as jest.Mock).mockResolvedValue(
                jsonResponse(account(9, 'guest@example.com', 'guest'), 201)
            );
            await openAddForm();
            fireEvent.change(
                document.querySelector('input[type="email"]') as Element,
                { target: { value: 'guest@example.com' } }
            );
            fireEvent.click(screen.getByText('User', { selector: 'span' }));
            fireEvent.click(await screen.findByTestId('role-option-guest'));

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalled());
            const body = JSON.parse(
                (fetchWithCsrf as jest.Mock).mock.calls[0][1].body
            );
            expect(body.role).toBe('guest');
            expect(body.capabilities).toEqual({
                create_people: false,
                invite_members: false,
                create_projects: false,
            });
        });

        it('loads an existing account with its own permissions when editing', async () => {
            mockAdminApi([
                {
                    ...account(4, 'helper@example.com', 'user'),
                    capabilities: {
                        create_people: true,
                        invite_members: true,
                        create_projects: false,
                    },
                },
            ]);
            renderPage();
            fireEvent.click(await screen.findByTitle('Edit'));

            await screen.findByTestId('permissions-section');
            expect(
                screen.getByTestId('capability-switch-invite_members')
            ).toHaveAttribute('aria-checked', 'true');
            expect(
                screen.getByTestId('capability-switch-create_projects')
            ).toHaveAttribute('aria-checked', 'false');
        });
    });
});
