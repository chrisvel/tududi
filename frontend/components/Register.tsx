import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAssetPath } from '../config/paths';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { t } = useTranslation();
    const [isDarkMode] = useState<boolean>(() => {
        const storedPreference = localStorage.getItem('isDarkMode');
        return storedPreference !== null
            ? storedPreference === 'true'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError(t('auth.passwords_not_match', 'Passwords do not match'));
            return;
        }

        if (password.length < 6) {
            setError(
                t(
                    'auth.password_too_short',
                    'Password must be at least 6 characters long'
                )
            );
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
            } else {
                setError(
                    data.error ||
                        t(
                            'auth.registration_failed',
                            'Registration failed. Please try again.'
                        )
                );
            }
        } catch (err) {
            setError(
                t('auth.error_occurred', 'An error occurred. Please try again.')
            );
            console.error('Error during registration:', err);
        }
    };

    if (success) {
        return (
            <>
                {/* Navbar */}
                <nav className="fixed top-0 left-0 right-0 z-50 text-gray-900 dark:text-white">
                    <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8">
                        <img
                            src={
                                isDarkMode
                                    ? '/wide-logo-light.png'
                                    : '/wide-logo-dark.png'
                            }
                            alt="tududi"
                            className="h-9 w-auto"
                        />
                    </div>
                </nav>

                {/* Main Content */}
                <div className="bg-gray-100 dark:bg-gray-900 min-h-screen px-4 pt-16 flex items-center justify-center">
                    <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
                        {/* Left side - Success Message */}
                        <div className="w-full lg:w-auto flex flex-col items-center">
                            <div className="p-10 rounded-lg w-full max-w-2xl">
                                <div className="text-center">
                                    <div className="mb-4 text-green-600 dark:text-green-400 text-5xl">
                                        ✓
                                    </div>
                                    <h2
                                        className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200"
                                        data-testid="register-success-heading"
                                    >
                                        {t(
                                            'auth.registration_successful',
                                            'Check Your Email'
                                        )}
                                    </h2>
                                    <p
                                        className="text-gray-600 dark:text-gray-400 mb-6"
                                        data-testid="register-success-message"
                                    >
                                        {t(
                                            'auth.registration_email_sent',
                                            'We have sent a verification link to your email address. Please check your inbox and click the link to verify your account.'
                                        )}
                                    </p>
                                    <Link
                                        to="/login"
                                        className="text-blue-500 hover:text-blue-600"
                                        data-testid="register-success-back-link"
                                    >
                                        {t(
                                            'auth.back_to_login',
                                            'Back to Login'
                                        )}
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Right side - Graphic */}
                        <div className="hidden lg:flex items-center justify-center">
                            <img
                                src={getAssetPath('login-gfx.png')}
                                alt="Registration illustration"
                                className="max-w-md w-full h-auto"
                            />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 text-gray-900 dark:text-white">
                <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8">
                    <img
                        src={
                            isDarkMode
                                ? '/wide-logo-light.png'
                                : '/wide-logo-dark.png'
                        }
                        alt="tududi"
                        className="h-9 w-auto"
                    />
                </div>
            </nav>

            {/* Main Content */}
            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen px-4 pt-16 flex items-center justify-center">
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
                    {/* Left side - Register Form */}
                    <div className="w-full lg:w-auto flex flex-col items-center">
                        <div className="p-10 rounded-lg w-full max-w-2xl">
                            <h2
                                className="text-center text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-12"
                                data-testid="register-heading"
                            >
                                {t('auth.sign_up', 'Sign Up')}
                            </h2>
                            {error && (
                                <div
                                    className="mb-4 text-center text-red-500"
                                    data-testid="register-error"
                                >
                                    {error}
                                </div>
                            )}
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
                                        data-testid="register-email"
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
                                        data-testid="register-password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="mb-4">
                                    <label
                                        htmlFor="confirmPassword"
                                        className="block text-gray-600 dark:text-gray-300 mb-1"
                                    >
                                        {t(
                                            'auth.confirm_password',
                                            'Confirm Password'
                                        )}
                                    </label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) =>
                                            setConfirmPassword(e.target.value)
                                        }
                                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        data-testid="register-confirm-password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                                    data-testid="register-submit"
                                >
                                    {t('auth.sign_up', 'Sign Up')}
                                </button>
                            </form>
                            <div className="mt-6 text-center text-gray-600 dark:text-gray-400">
                                {t(
                                    'auth.already_have_account',
                                    'Already have an account?'
                                )}{' '}
                                <Link
                                    to="/login"
                                    className="text-blue-500 hover:text-blue-600"
                                    data-testid="register-login-link"
                                >
                                    {t('auth.login', 'Login')}
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right side - Graphic */}
                    <div className="hidden lg:flex items-center justify-center">
                        <img
                            src={getAssetPath('login-gfx.png')}
                            alt="Registration illustration"
                            className="max-w-md w-full h-auto"
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Register;
