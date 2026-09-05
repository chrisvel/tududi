import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import { PASSWORD_MIN_LENGTH } from '../../utils/passwordPolicy';
import AuthPageShell from './AuthPageShell';

const ResetPassword: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError(t('auth.passwords_not_match', 'Passwords do not match'));
            return;
        }
        if (password.length < PASSWORD_MIN_LENGTH) {
            setError(
                t('auth.password_too_short', {
                    defaultValue:
                        'Password must be at least {{count}} characters long',
                    count: PASSWORD_MIN_LENGTH,
                })
            );
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch(getApiPath('reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
                credentials: 'include',
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                setDone(true);
            } else {
                setError(
                    data.error ||
                        t(
                            'auth.reset_failed',
                            'This reset link is invalid or has expired.'
                        )
                );
            }
        } catch (err) {
            setError(
                t('auth.error_occurred', 'An error occurred. Please try again.')
            );
            console.error('Error resetting password:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass =
        'w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';

    return (
        <AuthPageShell
            title={t('auth.reset_password_title', 'Choose a new password')}
        >
            {!token ? (
                <div className="text-center">
                    <p className="text-red-500 mb-6">
                        {t(
                            'auth.reset_link_missing',
                            'This reset link is incomplete. Request a new one.'
                        )}
                    </p>
                    <Link
                        to="/forgot-password"
                        className="text-blue-500 hover:text-blue-600"
                    >
                        {t('auth.request_new_link', 'Request a new link')}
                    </Link>
                </div>
            ) : done ? (
                <div className="text-center" data-testid="reset-done">
                    <div className="mb-4 text-green-600 dark:text-green-400 text-5xl">
                        ✓
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t(
                            'auth.reset_password_done',
                            'Your password has been updated. You can now log in.'
                        )}
                    </p>
                    <Link
                        to="/login"
                        className="text-blue-500 hover:text-blue-600"
                    >
                        {t('auth.back_to_login', 'Back to Login')}
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {error && (
                        <div
                            className="mb-4 text-center text-red-500"
                            data-testid="reset-error"
                        >
                            {error}
                        </div>
                    )}
                    <div className="mb-4">
                        <label
                            htmlFor="password"
                            className="block text-gray-600 dark:text-gray-300 mb-1"
                        >
                            {t('auth.newPassword', 'New Password')}
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClass}
                            data-testid="reset-password"
                            minLength={PASSWORD_MIN_LENGTH}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label
                            htmlFor="confirmPassword"
                            className="block text-gray-600 dark:text-gray-300 mb-1"
                        >
                            {t('auth.confirmPassword', 'Confirm Password')}
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={inputClass}
                            data-testid="reset-confirm-password"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60"
                        data-testid="reset-submit"
                    >
                        {t('auth.resetPassword', 'Reset Password')}
                    </button>
                </form>
            )}
        </AuthPageShell>
    );
};

export default ResetPassword;
