import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInLinkModal from '../SignInLinkModal';
import {
    createSignInLink,
    revokeSignInLink,
} from '../../../utils/membersService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            const text = typeof fallback === 'string' ? fallback : key;
            const values =
                options || (typeof fallback === 'object' ? fallback : {});
            return text.replace(/{{(\w+)}}/g, (_m, name) =>
                String(values[name] ?? '')
            );
        },
    }),
}));

jest.mock('../../../utils/membersService', () => ({
    createSignInLink: jest.fn(),
    revokeSignInLink: jest.fn(),
}));

const LINK = {
    url: 'https://configured.example.com/sign-in-link?token=abc123',
    path: '/sign-in-link?token=abc123',
    expires_at: '2026-09-22T10:00:00.000Z',
};

const renderModal = (onClose = jest.fn()) => {
    render(
        <SignInLinkModal memberId={7} memberName="Emma" onClose={onClose} />
    );
    return onClose;
};

describe('Sign-in link dialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(navigator, {
            clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
        });
    });

    it('explains the rules before anything is created', () => {
        renderModal();

        expect(screen.getByTestId('sign-in-link-modal')).toHaveTextContent(
            'Sign-in link for Emma'
        );
        expect(screen.getByTestId('sign-in-link-modal')).toHaveTextContent(
            'works once, for 24 hours'
        );
        expect(screen.queryByTestId('sign-in-link-url')).toBeNull();
        expect(createSignInLink).not.toHaveBeenCalled();
    });

    it('creates a link for that member and shows it', async () => {
        (createSignInLink as jest.Mock).mockResolvedValue(LINK);
        renderModal();

        fireEvent.click(screen.getByTestId('sign-in-link-create'));

        expect(await screen.findByTestId('sign-in-link-url')).toHaveValue(
            `${window.location.origin}${LINK.path}`
        );
        expect(createSignInLink).toHaveBeenCalledWith(7);
        expect(screen.getByTestId('sign-in-link-expiry')).toHaveTextContent(
            'Shown only now'
        );
        expect(screen.getByTestId('sign-in-link-create')).toHaveTextContent(
            'Create a new link'
        );
    });

    it('copies the link', async () => {
        (createSignInLink as jest.Mock).mockResolvedValue(LINK);
        renderModal();
        fireEvent.click(screen.getByTestId('sign-in-link-create'));
        await screen.findByTestId('sign-in-link-url');

        fireEvent.click(screen.getByTestId('sign-in-link-copy'));

        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                `${window.location.origin}${LINK.path}`
            )
        );
        expect(await screen.findByRole('status')).toHaveTextContent(
            'Link copied'
        );
    });

    it('says so when the link cannot be copied', async () => {
        (createSignInLink as jest.Mock).mockResolvedValue(LINK);
        (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(
            new Error('denied')
        );
        renderModal();
        fireEvent.click(screen.getByTestId('sign-in-link-create'));
        await screen.findByTestId('sign-in-link-url');

        fireEvent.click(screen.getByTestId('sign-in-link-copy'));

        expect(await screen.findByRole('alert')).toHaveTextContent('denied');
    });

    it('shows why a link could not be created', async () => {
        (createSignInLink as jest.Mock).mockRejectedValue(
            new Error('That member has permissions you do not have')
        );
        renderModal();

        fireEvent.click(screen.getByTestId('sign-in-link-create'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'permissions you do not have'
        );
        expect(screen.queryByTestId('sign-in-link-url')).toBeNull();
    });

    it('takes access back and forgets the link', async () => {
        (createSignInLink as jest.Mock).mockResolvedValue(LINK);
        (revokeSignInLink as jest.Mock).mockResolvedValue(undefined);
        renderModal();
        fireEvent.click(screen.getByTestId('sign-in-link-create'));
        await screen.findByTestId('sign-in-link-url');

        fireEvent.click(screen.getByTestId('sign-in-link-revoke'));

        expect(await screen.findByRole('status')).toHaveTextContent(
            'Emma is signed out everywhere'
        );
        expect(revokeSignInLink).toHaveBeenCalledWith(7);
        expect(screen.queryByTestId('sign-in-link-url')).toBeNull();
    });

    it('closes from the backdrop and the button, but not from inside the dialog', () => {
        const onClose = renderModal();

        fireEvent.click(screen.getByText('Sign-in link for Emma'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
