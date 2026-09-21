import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { getApiPath, getAssetPath } from '../../config/paths';
import { PublicNote, fetchPublicNote } from '../../utils/publicNotesService';

interface PublicNotePageProps {
    isSignedIn: boolean;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

type Stage = 'loading' | 'ready' | 'unavailable' | 'failed';

// A shared note, read by anyone who has the link: no sidebar and no account
// needed, just the tududi navbar and a way in. The page and the API answer the
// same for a link that never existed and one the owner switched off.
const PublicNotePage: React.FC<PublicNotePageProps> = ({
    isSignedIn,
    isDarkMode,
    toggleDarkMode,
}) => {
    const { t, i18n } = useTranslation();
    const { token = '' } = useParams<{ token: string }>();
    const [stage, setStage] = useState<Stage>('loading');
    const [note, setNote] = useState<PublicNote | null>(null);
    const [registrationEnabled, setRegistrationEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setStage('loading');
        fetchPublicNote(token)
            .then((result) => {
                if (cancelled) return;
                setNote(result);
                setStage(result ? 'ready' : 'unavailable');
            })
            .catch(() => {
                if (!cancelled) setStage('failed');
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    useEffect(() => {
        if (isSignedIn) return;
        let cancelled = false;
        fetch(getApiPath('registration-status'), { credentials: 'include' })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (!cancelled && data) setRegistrationEnabled(!!data.enabled);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isSignedIn]);

    // The link is a credential: keep search engines away from it.
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
        return () => {
            document.head.removeChild(meta);
        };
    }, []);

    useEffect(() => {
        const previous = document.title;
        if (stage === 'ready' && note?.title) {
            document.title = `${note.title} | tududi`;
        }
        return () => {
            document.title = previous;
        };
    }, [stage, note]);

    const updated =
        note?.updated_at &&
        new Date(note.updated_at).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

    const showSignUp = !isSignedIn && registrationEnabled;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <nav
                className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                data-testid="public-note-navbar"
            >
                <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link to={isSignedIn ? '/today' : '/login'}>
                        <img
                            src={getAssetPath(
                                isDarkMode
                                    ? 'wide-logo-light.png'
                                    : 'wide-logo-dark.png'
                            )}
                            alt="tududi"
                            className="h-9 w-auto"
                        />
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={toggleDarkMode}
                            className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white focus:outline-none"
                            aria-label={t(
                                'publicNote.toggleTheme',
                                'Toggle dark mode'
                            )}
                        >
                            {isDarkMode ? (
                                <SunIcon className="h-5 w-5" />
                            ) : (
                                <MoonIcon className="h-5 w-5" />
                            )}
                        </button>
                        {isSignedIn ? (
                            <Link
                                to="/today"
                                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                            >
                                {t('publicNote.openApp', 'Open tududi')}
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                    {t('auth.signin', 'Sign In')}
                                </Link>
                                {showSignUp && (
                                    <Link
                                        to="/register"
                                        className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                                    >
                                        {t('auth.signup', 'Sign Up')}
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </nav>

            <main
                className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 ${showSignUp ? 'pb-24' : 'pb-16'}`}
            >
                {stage === 'loading' && (
                    <p
                        className="text-center text-gray-600 dark:text-gray-300"
                        data-testid="public-note-loading"
                    >
                        {t('common.loading', 'Loading...')}
                    </p>
                )}

                {stage === 'unavailable' && (
                    <div
                        className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center"
                        data-testid="public-note-unavailable"
                    >
                        <h1 className="text-2xl font-semibold mb-3">
                            {t(
                                'publicNote.unavailableTitle',
                                'This note is not available'
                            )}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            {t(
                                'publicNote.unavailableBody',
                                'The link may be wrong, or the owner stopped sharing this note. Ask them for a new link.'
                            )}
                        </p>
                    </div>
                )}

                {stage === 'failed' && (
                    <div
                        className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center"
                        data-testid="public-note-failed"
                    >
                        <h1 className="text-2xl font-semibold mb-3">
                            {t(
                                'publicNote.failedTitle',
                                'Could not load this note'
                            )}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            {t(
                                'publicNote.failedBody',
                                'Something went wrong on our side. Try again in a moment.'
                            )}
                        </p>
                    </div>
                )}

                {stage === 'ready' && note && (
                    <article data-testid="public-note">
                        <header className="mb-6">
                            <h1 className="text-3xl font-light break-words">
                                {note.title ||
                                    t('notes.untitled', 'Untitled Note')}
                            </h1>
                            {updated && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t(
                                        'publicNote.updated',
                                        'Last updated {{date}}',
                                        { date: updated }
                                    )}
                                </p>
                            )}
                        </header>
                        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 break-words">
                            <MarkdownRenderer content={note.content || ''} />
                        </div>
                    </article>
                )}
            </main>

            {showSignUp && stage !== 'loading' && (
                <footer
                    className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur"
                    data-testid="public-note-cta"
                >
                    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
                        <p className="min-w-0 text-sm text-gray-700 dark:text-gray-200">
                            <span className="font-medium">
                                {t(
                                    'publicNote.ctaTitle',
                                    'Do you want to share your notes?'
                                )}
                            </span>
                            <span className="hidden md:inline text-gray-500 dark:text-gray-400">
                                {' '}
                                {t(
                                    'publicNote.ctaBody',
                                    'Write notes, keep them organized with your tasks and projects, and share any of them with a link.'
                                )}
                            </span>
                        </p>
                        <Link
                            to="/register"
                            className="flex-shrink-0 px-3 py-1 rounded border border-blue-600/40 text-sm text-blue-600 dark:text-blue-400 dark:border-blue-400/40 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                            {t('publicNote.ctaButton', 'Sign up now')}
                        </Link>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default PublicNotePage;
