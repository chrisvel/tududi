import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

// The page asks the API for the registration toggle, the OIDC providers
// and the auth methods; every answer here leaves password login on.
const okJson = (body: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('Login', () => {
    beforeEach(() => {
        // jsdom has no matchMedia; the page reads it for the dark-mode default
        window.matchMedia = jest.fn().mockReturnValue({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        }) as unknown as typeof window.matchMedia;
        global.fetch = jest.fn((url: string) => {
            if (String(url).includes('registration-status'))
                return okJson({ enabled: true });
            if (String(url).includes('oidc/providers'))
                return okJson({ providers: [] });
            return okJson({ passwordAuthEnabled: true, enabled: true });
        }) as unknown as typeof fetch;
    });

    it('renders the password form exactly once', async () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );
        await waitFor(() =>
            expect(screen.getAllByTestId('login-submit')).toHaveLength(1)
        );
        expect(screen.getAllByTestId('login-email')).toHaveLength(1);
        expect(screen.getAllByTestId('login-password')).toHaveLength(1);
        expect(screen.getAllByTestId('login-forgot-link')).toHaveLength(1);
    });

    it('asks for the 2FA code after the password, and signs in with it', async () => {
        global.fetch = jest.fn((url: string) => {
            const path = String(url);
            if (path.includes('login/mfa'))
                return okJson({ user: { email: 'a@example.com' } });
            if (path.endsWith('/login')) return okJson({ mfa_required: true });
            if (path.includes('oidc/providers'))
                return okJson({ providers: [] });
            return okJson({ enabled: true, user: null });
        }) as unknown as typeof fetch;
        const loggedIn = jest.fn();
        window.addEventListener('userLoggedIn', loggedIn);

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );
        fireEvent.change(await screen.findByTestId('login-email'), {
            target: { value: 'a@example.com' },
        });
        fireEvent.change(screen.getByTestId('login-password'), {
            target: { value: 'password123' },
        });
        fireEvent.click(screen.getByTestId('login-submit'));

        const code = await screen.findByTestId('mfa-code');
        expect(screen.queryByTestId('login-password')).not.toBeInTheDocument();
        fireEvent.change(code, { target: { value: '123456' } });
        fireEvent.click(screen.getByTestId('mfa-submit'));

        await waitFor(() => expect(loggedIn).toHaveBeenCalled());
        const mfaCall = (global.fetch as jest.Mock).mock.calls.find(([u]) =>
            String(u).includes('login/mfa')
        );
        expect(JSON.parse(mfaCall[1].body)).toEqual({ code: '123456' });
        window.removeEventListener('userLoggedIn', loggedIn);
    });

    it('picks up at the code prompt after a reload halfway through', async () => {
        global.fetch = jest.fn((url: string) => {
            if (String(url).includes('current_user'))
                return okJson({ user: null, mfa_pending: true });
            if (String(url).includes('oidc/providers'))
                return okJson({ providers: [] });
            return okJson({ enabled: true });
        }) as unknown as typeof fetch;

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        expect(await screen.findByTestId('mfa-code')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('mfa-toggle-recovery'));
        expect(screen.getByText('Recovery code')).toBeInTheDocument();
    });
});
