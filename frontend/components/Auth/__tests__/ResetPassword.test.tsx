import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '../ResetPassword';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

// The page shell reads window.matchMedia for the theme, which jsdom lacks.
jest.mock('../AuthPageShell', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('csrf-123'),
}));

describe('ResetPassword', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('sends the CSRF token with the reset request', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        render(
            <MemoryRouter initialEntries={['/reset-password?token=abc']}>
                <ResetPassword />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByTestId('reset-password'), {
            target: { value: 'a-long-new-password' },
        });
        fireEvent.change(screen.getByTestId('reset-confirm-password'), {
            target: { value: 'a-long-new-password' },
        });
        fireEvent.submit(screen.getByTestId('reset-password').closest('form')!);

        await waitFor(() =>
            expect(screen.getByTestId('reset-done')).toBeInTheDocument()
        );

        const [, init] = fetchMock.mock.calls[0];
        expect(init.method).toBe('POST');
        expect(init.headers['x-csrf-token']).toBe('csrf-123');
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(init.body)).toEqual({
            token: 'abc',
            password: 'a-long-new-password',
        });
    });
});
