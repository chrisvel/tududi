import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearCsrfToken } from '../../utils/csrfService';
import { peekSignInLink, redeemSignInLink } from '../../utils/membersService';
import AuthPageShell from './AuthPageShell';

type Stage = 'checking' | 'ready' | 'invalid';

// Where a sign-in link for a member without an email lands. Opening the link
// only shows this page: signing in is the button, so a chat app or scanner
// that previews the link cannot use it up.
const SignInLink: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [stage, setStage] = useState<Stage>('checking');
    const [name, setName] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!token) {
            setStage('invalid');
            return;
        }
        peekSignInLink(token)
            .then((result) => {
                if (cancelled) return;
                if (result) {
                    setName(result.name);
                    setStage('ready');
                } else {
                    setStage('invalid');
                }
            })
            .catch(() => {
                if (!cancelled) setStage('invalid');
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleSignIn = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const data = await redeemSignInLink(token);
            // The browser has a new session, so the old CSRF token is stale.
            clearCsrfToken();
            if (data.user?.language) {
                await i18n.changeLanguage(data.user.language);
            }
            window.dispatchEvent(
                new CustomEvent('userLoggedIn', { detail: data.user })
            );
            navigate('/today');
        } catch {
            setStage('invalid');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthPageShell title={t('signInLink.pageTitle', 'Sign in')}>
            {stage === 'checking' && (
                <p className="text-center text-gray-600 dark:text-gray-300">
                    {t('common.loading', 'Loading...')}
                </p>
            )}

            {stage === 'invalid' && (
                <div className="text-center" data-testid="sign-in-link-invalid">
                    <p className="text-red-500 mb-2">
                        {t(
                            'signInLink.invalid',
                            'This sign-in link does not work any more.'
                        )}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'signInLink.invalidHint',
                            'It may have been used already or expired. Ask the person who sent it for a new one.'
                        )}
                    </p>
                </div>
            )}

            {stage === 'ready' && (
                <div className="text-center space-y-4">
                    <p
                        className="text-gray-800 dark:text-gray-100"
                        data-testid="sign-in-link-question"
                    >
                        {name
                            ? t('signInLink.signInAs', 'Sign in as {{name}}?', {
                                  name,
                              })
                            : t('signInLink.signInAsYou', 'Sign in?')}
                    </p>
                    {error && (
                        <p className="text-sm text-red-500" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleSignIn}
                        disabled={submitting}
                        data-testid="sign-in-link-submit"
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                        {submitting
                            ? t('signInLink.signingIn', 'Signing in...')
                            : t('signInLink.signIn', 'Sign in')}
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'signInLink.stayHint',
                            'You will stay signed in on this device for 30 days.'
                        )}
                    </p>
                </div>
            )}
        </AuthPageShell>
    );
};

export default SignInLink;
