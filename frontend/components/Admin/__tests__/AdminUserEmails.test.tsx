import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminUserEmails from '../AdminUserEmails';
import {
    fetchUserEmails,
    previewUserEmail,
    sendUserEmail,
} from '../../../utils/adminEmailsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) => {
            const template =
                typeof fallback === 'string'
                    ? fallback
                    : (fallback?.defaultValue ?? key);
            const vars = typeof fallback === 'object' ? fallback : {};
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

jest.mock('../../../utils/adminEmailsService', () => ({
    fetchUserEmails: jest.fn(),
    previewUserEmail: jest.fn(),
    sendUserEmail: jest.fn(),
}));

const emails = {
    user: { id: 7, email: 'sam@example.com', language: 'de' },
    emails: [
        {
            key: 'passwordReset',
            can_send: true,
            reason: null,
            sent_count: 0,
            last_sent_at: null,
            last_status: null,
            recorded_before_log: null,
        },
        {
            key: 'verification',
            can_send: false,
            reason: 'The email address is already verified',
            sent_count: 1,
            last_sent_at: '2026-10-01T10:00:00.000Z',
            last_status: 'sent',
            recorded_before_log: null,
        },
    ],
    history: [
        {
            id: 1,
            email: 'verification',
            variant: null,
            subject: 'Willkommen bei Tududi',
            recipient: 'sam@example.com',
            language: 'de',
            status: 'sent',
            error: null,
            created_at: '2026-10-01T10:00:00.000Z',
            sent_by: null,
        },
    ],
};

describe('AdminUserEmails', () => {
    beforeEach(() => {
        (fetchUserEmails as jest.Mock).mockResolvedValue(emails);
        (previewUserEmail as jest.Mock).mockResolvedValue({
            key: 'passwordReset',
            to: 'sam@example.com',
            language: 'de',
            subject: 'Passwort zurücksetzen',
            text: 'Hallo, https://x/reset?token=PLACEHOLDER',
            html: null,
            note: null,
            link_placeholder: 'PLACEHOLDER',
        });
        (sendUserEmail as jest.Mock).mockResolvedValue({
            sent: true,
            error: null,
        });
    });

    it('shows what was sent, what was not, and why one cannot be sent', async () => {
        render(<AdminUserEmails userId={7} onClose={jest.fn()} />);
        expect(
            await screen.findByText('The email address is already verified')
        ).toBeInTheDocument();
        expect(screen.getByText('Not sent')).toBeInTheDocument();
        expect(screen.getByText('Willkommen bei Tududi')).toBeInTheDocument();
        expect(
            screen.getByTestId('admin-user-email-send-verification')
        ).toBeDisabled();
    });

    it('shows the exact email before sending, and sends only on confirm', async () => {
        const onSent = jest.fn();
        render(
            <AdminUserEmails userId={7} onClose={jest.fn()} onSent={onSent} />
        );
        fireEvent.click(
            await screen.findByTestId('admin-user-email-send-passwordReset')
        );

        expect(
            await screen.findByText('Passwort zurücksetzen')
        ).toBeInTheDocument();
        expect(
            screen.getByText(/The link is created when you send/)
        ).toBeInTheDocument();
        expect(sendUserEmail).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('admin-user-email-confirm'));
        await waitFor(() =>
            expect(sendUserEmail).toHaveBeenCalledWith(7, 'passwordReset')
        );
        expect(
            await screen.findByTestId('admin-user-emails-notice')
        ).toHaveTextContent('sent to sam@example.com');
        expect(onSent).toHaveBeenCalled();
    });
});
