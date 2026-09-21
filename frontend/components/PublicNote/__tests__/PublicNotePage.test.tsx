import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicNotePage from '../PublicNotePage';

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
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => (
        <div data-testid="markdown">{content}</div>
    ),
}));

const fetchPublicNote = jest.fn();
jest.mock('../../../utils/publicNotesService', () => ({
    fetchPublicNote: (...args: any[]) => fetchPublicNote(...args),
}));

const mockRegistration = (enabled: boolean) => {
    (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ enabled }),
    });
};

const renderPage = (props: { isSignedIn?: boolean } = {}) =>
    render(
        <MemoryRouter initialEntries={['/public/notes/tok-123']}>
            <Routes>
                <Route
                    path="/public/notes/:token"
                    element={
                        <PublicNotePage
                            isSignedIn={props.isSignedIn ?? false}
                            isDarkMode={false}
                            toggleDarkMode={jest.fn()}
                        />
                    }
                />
            </Routes>
        </MemoryRouter>
    );

const sharedNote = {
    title: 'Trip plan',
    content: '# Lisbon',
    color: null,
    updated_at: '2026-09-20T10:00:00.000Z',
};

describe('PublicNotePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRegistration(true);
    });

    it('asks for the note behind the link token', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage();
        await screen.findByTestId('public-note');
        expect(fetchPublicNote).toHaveBeenCalledWith('tok-123');
    });

    it('shows the note title and content', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage();

        expect(
            await screen.findByRole('heading', { name: 'Trip plan' })
        ).toBeInTheDocument();
        expect(screen.getByTestId('markdown')).toHaveTextContent('# Lisbon');
        expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    });

    it('has the navbar with a way to sign in, and no sidebar', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage();
        await screen.findByTestId('public-note');

        const navbar = screen.getByTestId('public-note-navbar');
        expect(navbar).toHaveTextContent('Sign In');
        expect(screen.getByAltText('tududi')).toBeInTheDocument();
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('invites a visitor to sign up when registration is open', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage();

        const cta = await screen.findByTestId('public-note-cta');
        expect(cta).toHaveTextContent('Do you want to share your notes?');
        expect(
            screen.getByRole('link', { name: 'Sign up now' })
        ).toHaveAttribute('href', '/register');
        expect(screen.getByTestId('public-note-navbar')).toHaveTextContent(
            'Sign Up'
        );
    });

    it('does not advertise sign up when registration is closed', async () => {
        mockRegistration(false);
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage();
        await screen.findByTestId('public-note');

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(screen.queryByTestId('public-note-cta')).not.toBeInTheDocument();
        expect(screen.getByTestId('public-note-navbar')).not.toHaveTextContent(
            'Sign Up'
        );
    });

    it('shows a signed-in reader a way back to the app instead of the pitch', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        renderPage({ isSignedIn: true });
        await screen.findByTestId('public-note');

        expect(
            screen.getByRole('link', { name: 'Open tududi' })
        ).toHaveAttribute('href', '/today');
        expect(screen.queryByTestId('public-note-cta')).not.toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('shows an error, and no content, when the link is not available', async () => {
        fetchPublicNote.mockResolvedValue(null);
        renderPage();

        expect(
            await screen.findByTestId('public-note-unavailable')
        ).toHaveTextContent('This note is not available');
        expect(screen.queryByTestId('public-note')).not.toBeInTheDocument();
        expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
        expect(screen.getByTestId('public-note-navbar')).toBeInTheDocument();
    });

    it('tells the reader something went wrong when the request fails', async () => {
        fetchPublicNote.mockRejectedValue(new Error('boom'));
        renderPage();

        expect(
            await screen.findByTestId('public-note-failed')
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId('public-note-unavailable')
        ).not.toBeInTheDocument();
    });

    it('asks search engines not to index the page', async () => {
        fetchPublicNote.mockResolvedValue(sharedNote);
        const { unmount } = renderPage();
        await screen.findByTestId('public-note');

        expect(
            document.head.querySelector('meta[name="robots"]')
        ).toHaveAttribute('content', 'noindex, nofollow');
        unmount();
        expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    });
});
