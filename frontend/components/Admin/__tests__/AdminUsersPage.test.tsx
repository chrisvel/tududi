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
});
