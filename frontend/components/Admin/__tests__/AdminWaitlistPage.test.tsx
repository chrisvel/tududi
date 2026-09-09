import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminWaitlistPage from '../AdminWaitlistPage';

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

const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast, showSuccessToast: jest.fn() }),
}));

const fetchWaitlist = jest.fn();
const downloadWaitlistCsv = jest.fn();
jest.mock('../../../utils/adminWaitlistService', () => ({
    fetchWaitlist: (...args: any[]) => fetchWaitlist(...args),
    downloadWaitlistCsv: (...args: any[]) => downloadWaitlistCsv(...args),
}));

const entry = (id: number, email: string) => ({
    id,
    email,
    source: 'pricing',
    locale: 'en',
    submission_count: 1,
    created_at: '2026-09-01T10:00:00.000Z',
});

describe('Admin waitlist page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchWaitlist.mockResolvedValue({
            total: 2,
            subscribers: [
                entry(1, 'one@example.com'),
                entry(2, 'two@example.com'),
            ],
        });
    });

    it('lists the addresses and says how many there are', async () => {
        render(<AdminWaitlistPage />);

        await waitFor(() =>
            expect(screen.getByText('one@example.com')).toBeInTheDocument()
        );
        expect(screen.getByText('two@example.com')).toBeInTheDocument();
        expect(screen.getByTestId('admin-waitlist-count')).toHaveTextContent(
            '1-2 of 2'
        );
    });

    it('searches from the first page', async () => {
        render(<AdminWaitlistPage />);
        await waitFor(() => expect(fetchWaitlist).toHaveBeenCalled());

        fireEvent.change(screen.getByTestId('admin-waitlist-search'), {
            target: { value: '  two  ' },
        });
        fireEvent.submit(screen.getByTestId('admin-waitlist-search'));

        await waitFor(() =>
            expect(fetchWaitlist).toHaveBeenLastCalledWith({
                q: 'two',
                limit: 50,
                offset: 0,
            })
        );
    });

    it('reports a failed load rather than showing an empty list as fact', async () => {
        fetchWaitlist.mockRejectedValueOnce(new Error('nope'));
        render(<AdminWaitlistPage />);

        await waitFor(() =>
            expect(showErrorToast).toHaveBeenCalledWith('nope')
        );
    });

    it('exports the whole list, not the page on screen', async () => {
        render(<AdminWaitlistPage />);
        await waitFor(() =>
            expect(screen.getByText('one@example.com')).toBeInTheDocument()
        );

        fireEvent.click(screen.getByTestId('admin-waitlist-export'));
        await waitFor(() => expect(downloadWaitlistCsv).toHaveBeenCalled());
    });
});
