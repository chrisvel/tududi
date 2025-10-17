import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
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
                setError(data.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Error during registration:', err);
        }
    };

    if (success) {
        return (
            <div className="bg-gray-100 flex flex-col items-center justify-center min-h-screen px-4">
                <h1 className="text-5xl font-bold text-gray-300 mb-6">tududi</h1>
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
                    <div className="text-center">
                        <div className="mb-4 text-green-600 text-5xl">✓</div>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">
                            {t('auth.registration_successful', 'Check Your Email')}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {t(
                                'auth.registration_email_sent',
                                'We have sent a verification link to your email address. Please check your inbox and click the link to verify your account.'
                            )}
                        </p>
                        <Link
                            to="/login"
                            className="text-blue-500 hover:text-blue-600"
                        >
                            {t('auth.back_to_login', 'Back to Login')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 flex flex-col items-center justify-center min-h-screen px-4">
            <h1 className="text-5xl font-bold text-gray-300 mb-6">tududi</h1>
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
                <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
                    {t('auth.sign_up', 'Sign Up')}
                </h2>
                {error && (
                    <div className="mb-4 text-center text-red-500">{error}</div>
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
                            minLength={6}
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            htmlFor="confirmPassword"
                            className="block text-gray-600 mb-1"
                        >
                            {t('auth.confirm_password', 'Confirm Password')}
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            minLength={6}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors mb-4"
                    >
                        {t('auth.sign_up', 'Sign Up')}
                    </button>
                    <div className="text-center text-gray-600">
                        {t('auth.already_have_account', 'Already have an account?')}{' '}
                        <Link
                            to="/login"
                            className="text-blue-500 hover:text-blue-600"
                        >
                            {t('auth.login', 'Login')}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;
