import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SqliteNoticeBanner from '../SqliteNoticeBanner';
import { fetchDatabaseInfo } from '../../../utils/adminDatabaseService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../../../utils/adminDatabaseService', () => ({
    fetchDatabaseInfo: jest.fn(),
}));

const mockInfo = fetchDatabaseInfo as jest.Mock;

const renderBanner = async (isAdmin: boolean) => {
    render(
        <MemoryRouter>
            <SqliteNoticeBanner isAdmin={isAdmin} />
        </MemoryRouter>
    );
    await act(() => new Promise((r) => setTimeout(r, 0)));
};

describe('SqliteNoticeBanner', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => mockInfo.mockReset());

    it('tells an admin of a SQLite instance to back up before 2.0', async () => {
        mockInfo.mockResolvedValue({ dialect: 'sqlite' });
        await renderBanner(true);

        expect(screen.getByTestId('sqlite-notice-banner')).toHaveTextContent(
            'tududi 2.0 runs on PostgreSQL only'
        );
        expect(screen.getByText('Back up now')).toHaveAttribute(
            'href',
            '/backup'
        );
    });

    it('stays hidden on PostgreSQL and for non-admins', async () => {
        mockInfo.mockResolvedValue({ dialect: 'postgres' });
        await renderBanner(true);
        expect(screen.queryByTestId('sqlite-notice-banner')).toBeNull();

        mockInfo.mockResolvedValue({ dialect: 'sqlite' });
        await renderBanner(false);
        expect(mockInfo).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('sqlite-notice-banner')).toBeNull();
    });

    it('stays away once dismissed', async () => {
        mockInfo.mockResolvedValue({ dialect: 'sqlite' });
        await renderBanner(true);
        fireEvent.click(screen.getByText('Dismiss'));
        expect(screen.queryByTestId('sqlite-notice-banner')).toBeNull();

        await renderBanner(true);
        expect(mockInfo).toHaveBeenCalledTimes(1);
    });
});
