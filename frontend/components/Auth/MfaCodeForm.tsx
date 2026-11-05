import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';

interface MfaCodeFormProps {
    onSuccess: (data: any) => void;
    onExpired: () => void;
}

// The second step of a sign-in on an account with two-factor sign-in: a
// code from the authenticator app, or one of the recovery codes.
const MfaCodeForm: React.FC<MfaCodeFormProps> = ({ onSuccess, onExpired }) => {
    const { t } = useTranslation();
    const [useRecovery, setUseRecovery] = useState(false);
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch(getApiPath('login/mfa'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    useRecovery ? { recovery_code: value } : { code: value }
                ),
                credentials: 'include',
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                onSuccess(data);
                return;
            }
            if (data.mfa_expired) {
                onExpired();
                return;
            }
            setValue('');
            setError(
                response.status === 429
                    ? t(
                          'mfa.tooManyAttempts',
                          'Too many incorrect codes. Please try again in 15 minutes.'
                      )
                    : t('mfa.wrongCode', 'That code is not right. Try again.')
            );
        } catch (err) {
            console.error('Error during two-factor sign-in:', err);
            setError(t('errors.generalError'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} data-testid="mfa-form">
            <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                {useRecovery
                    ? t(
                          'mfa.recoveryPrompt',
                          'Enter one of your recovery codes. Each code works once.'
                      )
                    : t(
                          'mfa.codePrompt',
                          'Enter the 6-digit code from your authenticator app.'
                      )}
            </p>
            {error && (
                <div className="mb-4 text-center text-red-500">{error}</div>
            )}
            <div className="mb-4">
                <label
                    htmlFor="mfa-code"
                    className="block text-gray-600 dark:text-gray-300 mb-1"
                >
                    {useRecovery
                        ? t('mfa.recoveryCode', 'Recovery code')
                        : t('mfa.code', 'Code')}
                </label>
                <input
                    id="mfa-code"
                    name="code"
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoComplete="one-time-code"
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    pattern={useRecovery ? undefined : '[0-9 ]*'}
                    maxLength={useRecovery ? 16 : 7}
                    autoFocus
                    required
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tracking-widest text-center"
                    data-testid="mfa-code"
                />
            </div>
            <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60"
                data-testid="mfa-submit"
            >
                {t('mfa.verify', 'Verify')}
            </button>
            <div className="mt-4 text-center">
                <button
                    type="button"
                    onClick={() => {
                        setUseRecovery(!useRecovery);
                        setValue('');
                        setError(null);
                    }}
                    className="text-sm text-blue-500 hover:text-blue-600"
                    data-testid="mfa-toggle-recovery"
                >
                    {useRecovery
                        ? t('mfa.useApp', 'Use your authenticator app')
                        : t('mfa.useRecovery', 'Use a recovery code')}
                </button>
            </div>
        </form>
    );
};

export default MfaCodeForm;
