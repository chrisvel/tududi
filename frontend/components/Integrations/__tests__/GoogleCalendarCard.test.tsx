import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import GoogleCalendarCard from '../GoogleCalendarCard';
import * as gcal from '../../../utils/gcalService';

jest.mock('react-i18next', () => {
    const t = (key: string, fallback?: any) =>
        typeof fallback === 'string'
            ? fallback
            : (fallback?.defaultValue ?? key);
    const value = { t };
    return { useTranslation: () => value };
});

const toast = { showSuccessToast: jest.fn(), showErrorToast: jest.fn() };
jest.mock('../../Shared/ToastContext', () => ({ useToast: () => toast }));
jest.mock('../../../utils/gcalService');
const api = gcal as jest.Mocked<typeof gcal>;

const base: gcal.GcalStatus = {
    available: true,
    connected: false,
    status: null,
    last_sync_at: null,
    last_error: null,
    can_export: false,
    export_enabled: false,
};

const renderCard = () =>
    render(
        <MemoryRouter>
            <GoogleCalendarCard />
        </MemoryRouter>
    );

describe('GoogleCalendarCard', () => {
    beforeEach(() => jest.clearAllMocks());

    it('offers Connect when not connected', async () => {
        api.fetchGcalStatus.mockResolvedValue(base);
        renderCard();
        expect(
            await screen.findByRole('button', {
                name: 'Connect Google Calendar',
            })
        ).toHaveAttribute('type', 'button');
    });

    it('says when the server has no Google client', async () => {
        api.fetchGcalStatus.mockResolvedValue({ ...base, available: false });
        renderCard();
        expect(
            await screen.findByText(/not set up on this server/)
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('tells the user when Google did not confirm the revoke', async () => {
        api.fetchGcalStatus
            .mockResolvedValueOnce({
                ...base,
                connected: true,
                status: 'active',
                last_sync_at: '2026-01-01T10:00:00Z',
            })
            .mockResolvedValueOnce(base);
        api.disconnectGcal.mockResolvedValue({
            disconnected: true,
            revoked: false,
        });
        renderCard();
        fireEvent.click(
            await screen.findByRole('button', { name: 'Disconnect' })
        );
        await waitFor(() =>
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                expect.stringMatching(/Google did not confirm/)
            )
        );
        expect(
            await screen.findByRole('button', {
                name: 'Connect Google Calendar',
            })
        ).toBeInTheDocument();
    });
});
