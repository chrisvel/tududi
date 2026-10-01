import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminFeedbackPage from '../AdminFeedbackPage';

jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: any) => (
        <a href={to} {...rest}>
            {children}
        </a>
    ),
}));

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

const fetchFeedback = jest.fn();
const setFeedbackResolved = jest.fn();
const deleteFeedback = jest.fn();
jest.mock('../../../utils/feedbackService', () => ({
    fetchFeedback: (...args: any[]) => fetchFeedback(...args),
    setFeedbackResolved: (...args: any[]) => setFeedbackResolved(...args),
    deleteFeedback: (...args: any[]) => deleteFeedback(...args),
}));

const entry = (id: number, message: string, resolved_at: string | null) => ({
    id,
    message,
    page_url: '/today',
    user_agent: 'Mozilla/5.0',
    app_version: 'v1.6.4',
    resolved_at,
    created_at: '2026-10-01T10:00:00.000Z',
    user: { uid: 'u1', email: 'ana@example.com', name: 'Ana Lee' },
});

describe('Admin feedback page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetchFeedback.mockResolvedValue({
            total: 1,
            open: 1,
            feedback: [entry(1, 'Search is slow', null)],
        });
        setFeedbackResolved.mockResolvedValue({});
    });

    it('shows open feedback with the sender and page', async () => {
        render(<AdminFeedbackPage />);

        await waitFor(() =>
            expect(screen.getByText('Search is slow')).toBeInTheDocument()
        );
        expect(fetchFeedback).toHaveBeenCalledWith({
            status: 'open',
            limit: 50,
            offset: 0,
        });
        expect(
            screen.getByText('Ana Lee · ana@example.com')
        ).toBeInTheDocument();
        expect(screen.getByText('/today')).toHaveAttribute('href', '/today');
        expect(screen.getByTestId('admin-feedback-tab-open')).toHaveTextContent(
            'Open (1)'
        );
    });

    it('marks an item resolved and reloads', async () => {
        render(<AdminFeedbackPage />);
        await screen.findByText('Search is slow');

        fireEvent.click(screen.getByTestId('admin-feedback-toggle'));

        await waitFor(() =>
            expect(setFeedbackResolved).toHaveBeenCalledWith(1, true)
        );
        await waitFor(() => expect(fetchFeedback).toHaveBeenCalledTimes(2));
    });

    it('switches to the resolved tab', async () => {
        render(<AdminFeedbackPage />);
        await screen.findByText('Search is slow');

        fireEvent.click(screen.getByTestId('admin-feedback-tab-resolved'));

        await waitFor(() =>
            expect(fetchFeedback).toHaveBeenLastCalledWith({
                status: 'resolved',
                limit: 50,
                offset: 0,
            })
        );
    });

    it('says when nothing is open', async () => {
        fetchFeedback.mockResolvedValue({ total: 0, open: 0, feedback: [] });
        render(<AdminFeedbackPage />);

        expect(
            await screen.findByTestId('admin-feedback-empty')
        ).toHaveTextContent('Nothing open. Nice.');
    });
});
