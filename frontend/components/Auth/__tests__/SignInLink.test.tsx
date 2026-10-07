import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SignInLink from '../SignInLink';
import {
    peekSignInLink,
    redeemSignInLink,
} from '../../../utils/membersService';
import { clearCsrfToken } from '../../../utils/csrfService';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

const mockChangeLanguage = jest.fn().mockResolvedValue(undefined);
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            const text = typeof fallback === 'string' ? fallback : key;
            const values = options || {};
            return text.replace(/{{(\w+)}}/g, (_m, name) =>
                String(values[name] ?? '')
            );
        },
        i18n: { changeLanguage: mockChangeLanguage },
    }),
}));

jest.mock('../../../utils/membersService', () => ({
    peekSignInLink: jest.fn(),
    redeemSignInLink: jest.fn(),
}));

jest.mock('../../../utils/csrfService', () => ({
    clearCsrfToken: jest.fn(),
}));

jest.mock('../AuthPageShell', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

const renderPage = (search = '?token=abc123') =>
    render(
        <MemoryRouter initialEntries={[`/sign-in-link${search}`]}>
            <SignInLink />
        </MemoryRouter>
    );

describe('Sign-in link page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('asks who is signing in and does not sign in by itself', async () => {
        (peekSignInLink as jest.Mock).mockResolvedValue({ name: 'Emma' });

        renderPage();

        expect(
            await screen.findByTestId('sign-in-link-question')
        ).toHaveTextContent('Sign in as Emma?');
        expect(peekSignInLink).toHaveBeenCalledWith('abc123');
        expect(redeemSignInLink).not.toHaveBeenCalled();
    });

    it('signs in when the button is pressed', async () => {
        (peekSignInLink as jest.Mock).mockResolvedValue({ name: 'Emma' });
        (redeemSignInLink as jest.Mock).mockResolvedValue({
            user: { uid: 'u1', name: 'Emma', language: 'el' },
        });
        const loggedIn = jest.fn();
        window.addEventListener('userLoggedIn', loggedIn);
        renderPage();

        fireEvent.click(await screen.findByTestId('sign-in-link-submit'));

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('/today')
        );
        expect(redeemSignInLink).toHaveBeenCalledWith('abc123');
        expect(clearCsrfToken).toHaveBeenCalled();
        expect(mockChangeLanguage).toHaveBeenCalledWith('el');
        expect(loggedIn).toHaveBeenCalledTimes(1);
        expect((loggedIn.mock.calls[0][0] as CustomEvent).detail).toEqual({
            uid: 'u1',
            name: 'Emma',
            language: 'el',
        });
        window.removeEventListener('userLoggedIn', loggedIn);
    });

    it('says the link does not work when the server does not know it', async () => {
        (peekSignInLink as jest.Mock).mockResolvedValue(null);

        renderPage();

        expect(
            await screen.findByTestId('sign-in-link-invalid')
        ).toHaveTextContent('does not work any more');
        expect(screen.queryByTestId('sign-in-link-submit')).toBeNull();
    });

    it('says the same when there is no token at all', async () => {
        renderPage('');

        expect(await screen.findByTestId('sign-in-link-invalid')).toBeVisible();
        expect(peekSignInLink).not.toHaveBeenCalled();
    });

    it('says the same when the check itself fails', async () => {
        (peekSignInLink as jest.Mock).mockRejectedValue(new Error('down'));

        renderPage();

        expect(await screen.findByTestId('sign-in-link-invalid')).toBeVisible();
    });

    it('says the link does not work when it was used up between looking and signing in', async () => {
        (peekSignInLink as jest.Mock).mockResolvedValue({ name: 'Emma' });
        (redeemSignInLink as jest.Mock).mockRejectedValue(new Error('no'));
        renderPage();

        fireEvent.click(await screen.findByTestId('sign-in-link-submit'));

        expect(await screen.findByTestId('sign-in-link-invalid')).toBeVisible();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
