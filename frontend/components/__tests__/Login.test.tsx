import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
});
