import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminUsersPage from '../AdminUsersPage';

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
});
