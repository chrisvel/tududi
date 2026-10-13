import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackModal from '../FeedbackModal';

jest.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: '/projects/abc', search: '?tab=notes' }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const showSuccessToast = jest.fn();
const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showSuccessToast, showErrorToast }),
}));

const submitFeedback = jest.fn();
jest.mock('../../../utils/feedbackService', () => ({
    submitFeedback: (...args: any[]) => submitFeedback(...args),
}));

describe('FeedbackModal', () => {
    beforeEach(() => {
        submitFeedback.mockReset();
        showSuccessToast.mockReset();
        showErrorToast.mockReset();
    });

    it('keeps Send disabled until something is typed', () => {
        render(<FeedbackModal onClose={jest.fn()} />);
        const send = screen.getByTestId('feedback-submit');
        expect(send).toBeDisabled();

        fireEvent.change(screen.getByTestId('feedback-message'), {
            target: { value: '   ' },
        });
        expect(send).toBeDisabled();

        fireEvent.change(screen.getByTestId('feedback-message'), {
            target: { value: 'Broken' },
        });
        expect(send).toBeEnabled();
    });

    it('sends the message with the current page and version, then closes', async () => {
        submitFeedback.mockResolvedValue(undefined);
        const onClose = jest.fn();
        render(<FeedbackModal onClose={onClose} appVersion="v1.6.4" />);

        fireEvent.change(screen.getByTestId('feedback-message'), {
            target: { value: '  The board does not scroll  ' },
        });
        fireEvent.click(screen.getByTestId('feedback-submit'));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(submitFeedback).toHaveBeenCalledWith({
            message: 'The board does not scroll',
            page_url: '/projects/abc?tab=notes',
            app_version: 'v1.6.4',
        });
        expect(showSuccessToast).toHaveBeenCalled();
    });

    it('stays open and shows the error when sending fails', async () => {
        submitFeedback.mockRejectedValue(new Error('Rate limit exceeded'));
        const onClose = jest.fn();
        render(<FeedbackModal onClose={onClose} />);

        fireEvent.change(screen.getByTestId('feedback-message'), {
            target: { value: 'Hello' },
        });
        fireEvent.click(screen.getByTestId('feedback-submit'));

        await waitFor(() =>
            expect(showErrorToast).toHaveBeenCalledWith('Rate limit exceeded')
        );
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByTestId('feedback-message')).toHaveValue('Hello');
    });

    it('closes on Escape', () => {
        const onClose = jest.fn();
        render(<FeedbackModal onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
