import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import {
    MfaSetup,
    MfaStatus,
    disableMfa,
    enableMfa,
    fetchMfaStatus,
    regenerateRecoveryCodes,
    startMfaSetup,
} from '../../../utils/mfaService';
import {
    ApiKeySummary,
    fetchApiKeys,
    revokeApiKey,
} from '../../../utils/apiKeysService';
import { useReverify } from '../../Auth/useReverify';

type Step = 'idle' | 'setup' | 'codes' | 'disable';

// This card sits inside the profile page's own <form>, so it has no forms
// of its own (a nested form is dropped and its button would save the
// profile). Enter in a code field runs the step instead.
const onEnter =
    (action: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action();
        }
    };

const inputClass =
    'block w-full rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
const primaryButton =
    'px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60';
const secondaryButton =
    'px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600';

// Profile > Security: turn two-factor sign-in on or off, and look after the
// recovery codes. Right after turning it on, lists the API keys that still
// work without a code, so old ones can be revoked.
const TwoFactorCard: React.FC = () => {
    const { t } = useTranslation();
    const { runWithReverify, reverifyModal } = useReverify();
    const [status, setStatus] = useState<MfaStatus | null>(null);
    const [step, setStep] = useState<Step>('idle');
    const [setup, setSetup] = useState<MfaSetup | null>(null);
    const [code, setCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [activeKeys, setActiveKeys] = useState<ApiKeySummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setStatus(await fetchMfaStatus());
        } catch (err) {
            console.error('Could not load two-factor status:', err);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err: any) {
            setError(err?.message || t('errors.generalError'));
        } finally {
            setBusy(false);
        }
    };

    const beginSetup = () =>
        run(async () => {
            setSetup(await startMfaSetup());
            setCode('');
            setStep('setup');
        });

    const confirmSetup = () => {
        run(async () => {
            const result = await enableMfa(code.replace(/\s/g, ''));
            setRecoveryCodes(result.recovery_codes);
            setSetup(null);
            setStep('codes');
            const keys = await fetchApiKeys().catch(() => []);
            setActiveKeys(keys.filter((key) => !key.revoked_at));
            await load();
        });
    };

    const newCodes = () =>
        run(async () => {
            const result = await runWithReverify(regenerateRecoveryCodes);
            if (!result) return;
            setRecoveryCodes(result.recovery_codes);
            setActiveKeys([]);
            setStep('codes');
            await load();
        });

    const confirmDisable = () => {
        run(async () => {
            const value = code.replace(/\s/g, '');
            await disableMfa(
                /^\d{6}$/.test(value)
                    ? { code: value }
                    : { recovery_code: code }
            );
            setStep('idle');
            setCode('');
            await load();
        });
    };

    const revoke = (id: number) =>
        run(async () => {
            await revokeApiKey(id);
            setActiveKeys((keys) => keys.filter((key) => key.id !== id));
        });

    const revokeAll = () =>
        run(async () => {
            for (const key of activeKeys) await revokeApiKey(key.id);
            setActiveKeys([]);
        });

    const codesText = recoveryCodes.join('\n');

    const downloadCodes = () => {
        const blob = new Blob([`${codesText}\n`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tududi-recovery-codes.txt';
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!status) return null;

    return (
        <div
            className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
            data-testid="mfa-card"
        >
            {reverifyModal}
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                <DevicePhoneMobileIcon className="w-5 h-5 mr-2 text-blue-500" />
                {t('mfa.title', 'Two-factor sign-in')}
                {status.enabled && (
                    <span className="ml-3 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        {t('mfa.on', 'On')}
                    </span>
                )}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t(
                    'mfa.description',
                    'Ask for a code from an authenticator app, as well as your password or single sign-on, whenever this account signs in on a new device.'
                )}
            </p>

            {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

            {step === 'idle' && !status.enabled && (
                <>
                    {!status.available && (
                        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
                            {t(
                                'mfa.unavailable',
                                'Two-factor sign-in needs TUDUDI_SESSION_SECRET to be set on the server. Ask your administrator.'
                            )}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={beginSetup}
                        disabled={busy || !status.available}
                        className={primaryButton}
                        data-testid="mfa-setup-start"
                    >
                        {t('mfa.turnOn', 'Turn on')}
                    </button>
                </>
            )}

            {step === 'setup' && setup && (
                <div className="space-y-4">
                    <ol className="list-decimal ml-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <li>
                            {t(
                                'mfa.setupScan',
                                'Scan this QR code with an authenticator app, such as Google Authenticator, 1Password or Aegis.'
                            )}
                        </li>
                        <li>
                            {t(
                                'mfa.setupEnter',
                                'Enter the 6-digit code the app shows.'
                            )}
                        </li>
                    </ol>
                    <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr_svg)}`}
                        alt={t(
                            'mfa.qrAlt',
                            'QR code for your authenticator app'
                        )}
                        className="w-48 h-48 bg-white p-2 rounded"
                        data-testid="mfa-qr"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('mfa.setupManual', 'Or type this key into the app:')}
                        <code className="block mt-1 font-mono break-all text-gray-900 dark:text-gray-100">
                            {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
                        </code>
                    </div>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="123 456"
                        required
                        className={`${inputClass} max-w-[10rem] tracking-widest`}
                        onKeyDown={onEnter(confirmSetup)}
                        data-testid="mfa-setup-code"
                    />
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={confirmSetup}
                            disabled={busy || !code}
                            className={primaryButton}
                            data-testid="mfa-setup-confirm"
                        >
                            {t('mfa.confirm', 'Confirm')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('idle');
                                setSetup(null);
                            }}
                            className={secondaryButton}
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'codes' && (
                <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(
                            'mfa.codesIntro',
                            'Save these recovery codes somewhere safe. Each one signs you in once if you lose your phone. They are shown only now.'
                        )}
                    </p>
                    <ul
                        className="grid grid-cols-2 gap-2 font-mono text-sm p-3 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        data-testid="mfa-recovery-codes"
                    >
                        {recoveryCodes.map((value) => (
                            <li key={value}>{value}</li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                navigator.clipboard?.writeText(codesText)
                            }
                            className={secondaryButton}
                        >
                            {t('mfa.copyCodes', 'Copy')}
                        </button>
                        <button
                            type="button"
                            onClick={downloadCodes}
                            className={secondaryButton}
                        >
                            {t('mfa.downloadCodes', 'Download')}
                        </button>
                    </div>

                    {activeKeys.length > 0 && (
                        <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20">
                            <p className="text-sm text-amber-900 dark:text-amber-200 mb-2">
                                {t(
                                    'mfa.keysIntro',
                                    'These API keys keep working without a code. Revoke any you do not recognise or no longer use.'
                                )}
                            </p>
                            <ul className="space-y-1 text-sm">
                                {activeKeys.map((key) => (
                                    <li
                                        key={key.id}
                                        className="flex items-center justify-between gap-2"
                                    >
                                        <span className="text-gray-900 dark:text-gray-100">
                                            {key.name}
                                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                                                {key.last_used_at
                                                    ? t('mfa.keyLastUsed', {
                                                          defaultValue:
                                                              'last used {{date}}',
                                                          date: new Date(
                                                              key.last_used_at
                                                          ).toLocaleDateString(),
                                                      })
                                                    : t(
                                                          'mfa.keyNeverUsed',
                                                          'never used'
                                                      )}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => revoke(key.id)}
                                            disabled={busy}
                                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                                        >
                                            {t('mfa.revoke', 'Revoke')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {activeKeys.length > 1 && (
                                <button
                                    type="button"
                                    onClick={revokeAll}
                                    disabled={busy}
                                    className="mt-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                                >
                                    {t('mfa.revokeAll', 'Revoke all')}
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setRecoveryCodes([]);
                            setActiveKeys([]);
                            setStep('idle');
                        }}
                        className={primaryButton}
                        data-testid="mfa-codes-done"
                    >
                        {t('mfa.codesSaved', 'I saved them')}
                    </button>
                </div>
            )}

            {step === 'idle' && status.enabled && (
                <div className="space-y-3">
                    <p
                        className={`text-sm ${
                            status.recovery_codes_left <= 2
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {t('mfa.codesLeft', {
                            defaultValue: '{{count}} recovery codes left.',
                            count: status.recovery_codes_left,
                        })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={newCodes}
                            disabled={busy}
                            className={secondaryButton}
                            data-testid="mfa-new-codes"
                        >
                            {t('mfa.newCodes', 'New recovery codes')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCode('');
                                setStep('disable');
                            }}
                            className="px-4 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                            data-testid="mfa-disable-start"
                        >
                            {t('mfa.turnOff', 'Turn off')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'disable' && (
                <div className="space-y-3">
                    <label className="block text-sm text-gray-700 dark:text-gray-300">
                        {t(
                            'mfa.disablePrompt',
                            'Enter a code from your authenticator app, or a recovery code, to turn two-factor sign-in off.'
                        )}
                    </label>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="one-time-code"
                        required
                        className={`${inputClass} max-w-[14rem] tracking-widest`}
                        onKeyDown={onEnter(confirmDisable)}
                        data-testid="mfa-disable-code"
                    />
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={confirmDisable}
                            disabled={busy || !code}
                            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                            data-testid="mfa-disable-confirm"
                        >
                            {t('mfa.turnOff', 'Turn off')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep('idle')}
                            className={secondaryButton}
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TwoFactorCard;
