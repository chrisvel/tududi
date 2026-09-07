import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import AuthPageShell from './AuthPageShell';
import CaptchaWidget from './CaptchaWidget';
import { fetchCaptchaConfig, CaptchaConfig } from '../../utils/captcha';

const ForgotPassword: React.FC = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [captcha, setCaptcha] = useState<CaptchaConfig | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [captchaReset, setCaptchaReset] = useState(0);

    useEffect(() => {
        fetchCaptchaConfig().then(setCaptcha);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (captcha && !captchaToken) {
            setError(
                t(
                    'auth.captcha_required',
                    'Please complete the verification and try again.'
                )
            );
            return;
        }
        setSubmitting(true);
        try {
            const response = await fetch(getApiPath('forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    ...(captchaToken ? { captcha_token: captchaToken } : {}),
                }),
                credentials: 'include',
            });
            if (response.ok) {
                setSent(true);
            } else {
                setCaptchaReset((k) => k + 1);
                const data = await response.json().catch(() => ({}));
                setError(
                    data.error ||
                        t(
                            'auth.error_occurred',
                            'An error occurred. Please try again.'
                        )
                );
            }
        } catch (err) {
            setError(
                t('auth.error_occurred', 'An error occurred. Please try again.')
            );
            console.error('Error requesting password reset:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthPageShell
            title={t('auth.forgot_password_title', 'Forgot your password?')}
        >
            {sent ? (
                <div className="text-center" data-testid="forgot-sent">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t(
                            'auth.forgot_password_sent',
                            'If an account exists for that email, we have sent a link to choose a new password. Check your inbox.'
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
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t(
                            'auth.forgot_password_intro',
                            'Enter the email address of your account and we will send you a link to choose a new password.'
                        )}
                    </p>
                    {error && (
                        <div
                            className="mb-4 text-center text-red-500"
                            data-testid="forgot-error"
                        >
                            {error}
                        </div>
                    )}
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
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            data-testid="forgot-email"
                            required
                        />
                    </div>
                    {captcha && (
                        <CaptchaWidget
                            siteKey={captcha.site_key}
                            onToken={setCaptchaToken}
                            resetKey={captchaReset}
                        />
                    )}
                    <button
                        type="submit"
                        disabled={submitting || (!!captcha && !captchaToken)}
                        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60"
                        data-testid="forgot-submit"
                    >
                        {t('auth.send_reset_link', 'Send reset link')}
                    </button>
                    <div className="mt-6 text-center text-gray-600 dark:text-gray-400">
                        <Link
                            to="/login"
                            className="text-blue-500 hover:text-blue-600"
                        >
                            {t('auth.back_to_login', 'Back to Login')}
                        </Link>
                    </div>
                </form>
            )}
        </AuthPageShell>
    );
};

export default ForgotPassword;
