import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const fetchRegistrationStatus = async () => {
            try {
                const response = await fetch('/api/registration-status');
                const data = await response.json();
                setRegistrationEnabled(data.enabled);
            } catch (err) {
                console.error('Error fetching registration status:', err);
            }
        };

        fetchRegistrationStatus();

        const verified = searchParams.get('verified');
        const verificationError = searchParams.get('error');

        if (verified === 'true') {
            setSuccessMessage(
                t(
                    'auth.email_verified_success',
                    'Email verified successfully! You can now log in.'
                )
            );
        } else if (verified === 'false') {
            if (verificationError === 'expired') {
                setError(
                    t(
                        'auth.verification_link_expired',
                        'Verification link has expired. Please register again.'
                    )
                );
            } else if (verificationError === 'already_verified') {
                setSuccessMessage(
                    t('auth.email_already_verified', 'Email already verified. Please log in.')
                );
            } else {
                setError(
                    t(
                        'auth.invalid_verification_link',
                        'Invalid verification link. Please try again.'
                    )
                );
            }
        }
    }, [searchParams, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch('/api/login', {
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
                setError(data.error || data.errors?.[0] || 'Login failed. Please try again.');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Error during login:', err);
        }
    };

    return (
        <div className="bg-gray-100 flex flex-col items-center justify-center min-h-screen px-4">
            <h1 className="text-5xl font-bold text-gray-300 mb-6">tududi</h1>
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
                {error && (
                    <div className="mb-4 text-center text-red-500">{error}</div>
                )}
                {successMessage && (
                    <div className="mb-4 text-center text-green-600">
                        {successMessage}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label
                            htmlFor="email"
                            className="block text-gray-600 mb-1"
                        >
                            {t('auth.email', 'Email')}
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label
                            htmlFor="password"
                            className="block text-gray-600 mb-1"
                        >
                            {t('auth.password', 'Password')}
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        {t('auth.login', 'Login')}
                    </button>
                </form>
                {registrationEnabled && (
                    <div className="mt-4 text-center text-gray-600">
                        {t('auth.dont_have_account', "Don't have an account?")}{' '}
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
    );
};

export default Login;
