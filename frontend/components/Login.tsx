import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { getApiPath, getAssetPath } from '../config/paths';
import OIDCProviderButtons from './Auth/OIDCProviderButtons';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const [passwordAuthEnabled, setPasswordAuthEnabled] = useState(true);
    const [oidcProviders, setOidcProviders] = useState<
        Array<{ slug: string; name: string }>
    >([]);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [isDarkMode] = useState<boolean>(() => {
        const storedPreference = localStorage.getItem('isDarkMode');
        return storedPreference !== null
            ? storedPreference === 'true'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // Check for verification status and OIDC errors in URL params
    useEffect(() => {
        const verified = searchParams.get('verified');
        const verifyError = searchParams.get('error');
        const oidcError = searchParams.get('error');

        if (oidcError && !verified) {
            setError(oidcError);
        } else if (verified === 'true') {
            setSuccessMessage(
                t(
                    'auth.email_verified',
                    'Your email has been verified! You can now log in.'
                )
            );
        } else if (verified === 'false') {
            if (verifyError === 'expired') {
                setError(
                    t(
                        'auth.verification_expired',
                        'Verification link has expired. Please register again.'
                    )
                );
            } else if (verifyError === 'already_verified') {
                setSuccessMessage(
                    t(
                        'auth.already_verified',
                        'Your email is already verified. You can log in.'
                    )
                );
            } else {
                setError(
                    t(
                        'auth.verification_failed',
                        'Email verification failed. Please try again.'
                    )
                );
            }
        }
    }, [searchParams, t]);

    // Check if registration is enabled
    useEffect(() => {
        const checkRegistration = async () => {
            try {
                const response = await fetch(
                    getApiPath('registration-status'),
                    {
                        credentials: 'include',
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    setRegistrationEnabled(data.enabled);
                }
            } catch (err) {
                console.error('Error checking registration status:', err);
            }
        };
        checkRegistration();
    }, []);

    // Fetch OIDC providers
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await fetch(getApiPath('oidc/providers'), {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    setOidcProviders(data.providers || []);
                }
            } catch (err) {
                console.error('Error fetching OIDC providers:', err);
            }
        };
        fetchProviders();
    }, []);

    // Check if password authentication is enabled
    useEffect(() => {
        const checkPasswordAuth = async () => {
            try {
                const response = await fetch(
                    getApiPath('password-auth-status'),
                    {
                        credentials: 'include',
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    setPasswordAuthEnabled(data.enabled);
                }
            } catch (err) {
                console.error('Error checking password auth status:', err);
            }
        };
        checkPasswordAuth();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const response = await fetch(getApiPath('login'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
                if (data.user && data.user.language) {
                    await i18n.changeLanguage(data.user.language);
                }

                window.dispatchEvent(
                    new CustomEvent('userLoggedIn', { detail: data.user })
                );

                navigate('/today');
            } else {
                if (data.email_not_verified) {
                    setError(
                        t(
                            'auth.email_not_verified',
                            'Please verify your email address before logging in.'
                        )
                    );
                } else {
                    setError(
                        data.error ||
                            data.errors?.[0] ||
                            'Login failed. Please try again.'
                    );
                }
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Error during login:', err);
        }
    };

    return (
        <>
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 text-gray-900 dark:text-white">
                <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8">
                    <img
                        src={getAssetPath(
                            isDarkMode
                                ? 'wide-logo-light.png'
                                : 'wide-logo-dark.png'
                        )}
                        alt="TaskNoteTaker"
                        className="h-9 w-auto"
                    />
                </div>
            </nav>

            {/* Main Content */}
            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen px-4 pt-16 flex items-center justify-center">
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
                    {/* Left side - Login Form */}
                    <div className="w-full lg:w-auto flex flex-col items-center">
                        <div className="p-10 rounded-lg w-full max-w-2xl">
                            <h2 className="text-center text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-12">
                                {t('auth.login', 'Login')}
                            </h2>
                            {successMessage && (
                                <div className="mb-4 text-center text-green-600 dark:text-green-400">
                                    {successMessage}
                                </div>
                            )}
                            {error && (
                                <div className="mb-4 text-center text-red-500">
                                    {error}
                                </div>
                            )}

                            <OIDCProviderButtons providers={oidcProviders} />

                            {oidcProviders.length > 0 && passwordAuthEnabled && (
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                                            {t(
                                                'auth.or_continue_with_email',
                                                'Or continue with email'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {passwordAuthEnabled && (
                                <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label
                                        htmlFor="email"
                                        className="block text-gray-600 dark:text-gray-300 mb-1"
                                    >
                                        {t('auth.email', 'Email')}
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        data-testid="login-email"
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label
                                        htmlFor="password"
                                        className="block text-gray-600 dark:text-gray-300 mb-1"
                                    >
                                        {t('auth.password', 'Password')}
                                    </label>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        data-testid="login-password"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                                    data-testid="login-submit"
                                >
                                    {t('auth.login', 'Login')}
                                </button>
                            </form>
                            )}

                            {!passwordAuthEnabled && oidcProviders.length === 0 && (
                                <div className="text-center text-gray-600 dark:text-gray-400">
                                    {t(
                                        'auth.no_auth_methods',
                                        'No authentication methods available. Please contact your administrator.'
                                    )}
                                </div>
                            )}

                            {registrationEnabled && passwordAuthEnabled && (
                                <div className="mt-6 text-center text-gray-600 dark:text-gray-400">
                                    {t(
                                        'auth.no_account',
                                        "Don't have an account?"
                                    )}{' '}
                                    <Link
                                        to="/register"
                                        className="text-blue-500 hover:text-blue-600"
                                    >
                                        {t('auth.sign_up', 'Sign Up')}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side - Graphic */}
                    <div className="hidden lg:flex items-center justify-center">
                        <img
                            src={getAssetPath('login-gfx.png')}
                            alt="Login illustration"
                            className="max-w-md w-full h-auto"
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
