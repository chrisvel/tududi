import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import {
    fetchAdminOidcConfig,
    saveAdminOidcConfig,
    type AdminOidcConfig,
} from '../../../utils/adminOidcConfigService';

interface EditableProvider {
    slug: string;
    name: string;
    issuer: string;
    clientId: string;
    clientSecret?: string;
    scope: string;
    autoProvision: boolean;
    adminEmailDomainsText: string;
    client_secret_set: boolean;
    client_secret_last4: string | null;
}

function toEditable(
    provider: AdminOidcConfig['providers'][number]
): EditableProvider {
    return {
        slug: provider.slug,
        name: provider.name,
        issuer: provider.issuer,
        clientId: provider.clientId,
        clientSecret: undefined,
        scope: provider.scope || '',
        autoProvision: provider.autoProvision,
        adminEmailDomainsText: (provider.adminEmailDomains || []).join(', '),
        client_secret_set: provider.client_secret_set,
        client_secret_last4: provider.client_secret_last4,
    };
}

const emptyProvider = (): EditableProvider => ({
    slug: '',
    name: '',
    issuer: '',
    clientId: '',
    clientSecret: undefined,
    scope: 'openid profile email',
    autoProvision: true,
    adminEmailDomainsText: '',
    client_secret_set: false,
    client_secret_last4: null,
});

function LabeledInput({
    label,
    value,
    onChange,
    className = '',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    return (
        <div className={className}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {label}
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

// Admin-only: lets an admin configure OIDC/SSO providers from the database
// instead of .env -- the only option on a hosted instance, where nobody has
// shell access to edit .env and restart. See OIDCTab.tsx for the isAdmin
// gate, and backend/modules/oidc/configService.js for the storage/precedence
// rules this panel drives.
const OidcProviderConfig: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [source, setSource] = useState<'db' | 'env' | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [providers, setProviders] = useState<EditableProvider[]>([]);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            const config = await fetchAdminOidcConfig();
            setSource(config.source);
            setEnabled(config.enabled);
            setProviders(config.providers.map(toEditable));
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t(
                          'profile.oidcConfigLoadError',
                          'Failed to load OIDC configuration'
                      )
            );
        } finally {
            setLoading(false);
        }
    };

    const updateProvider = (
        index: number,
        patch: Partial<EditableProvider>
    ) => {
        setProviders((prev) =>
            prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
        );
    };

    const removeProvider = (index: number) => {
        setProviders((prev) => prev.filter((_, i) => i !== index));
    };

    const addProvider = () => {
        setProviders((prev) => [...prev, emptyProvider()]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                enabled,
                providers: providers.map((p) => ({
                    slug: p.slug.trim(),
                    name: p.name.trim(),
                    issuer: p.issuer.trim(),
                    clientId: p.clientId.trim(),
                    clientSecret: p.clientSecret || undefined,
                    scope: p.scope || undefined,
                    autoProvision: p.autoProvision,
                    adminEmailDomains: p.adminEmailDomainsText
                        .split(',')
                        .map((d) => d.trim())
                        .filter(Boolean),
                })),
            };
            const result = await saveAdminOidcConfig(payload);
            setSource(result.source);
            setEnabled(result.enabled);
            setProviders(result.providers.map(toEditable));
            showSuccessToast(
                t('profile.oidcConfigSaved', 'OIDC configuration saved')
            );
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t(
                          'profile.oidcConfigSaveError',
                          'Failed to save OIDC configuration'
                      )
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                {t('profile.loading', 'Loading...')}
            </div>
        );
    }

    return (
        <div className="mb-8">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {t('profile.oidcProviderConfig', 'Provider Configuration')}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {source === 'env'
                    ? t(
                          'profile.oidcConfigFromEnv',
                          "Showing what's currently loaded from .env. Save to move it into the database — changes then take effect within about 30 seconds, no restart needed."
                      )
                    : t(
                          'profile.oidcConfigFromDb',
                          'Saved to the database. This overrides any OIDC_* environment variables while a configuration exists here.'
                      )}
            </p>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                <div className="flex items-center justify-between px-4 py-4">
                    <div className="pr-8">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('profile.oidcEnabled', 'OIDC/SSO enabled')}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t(
                                'profile.oidcEnabledDescription',
                                'Turns SSO login on or off for everyone on this instance.'
                            )}
                        </p>
                    </div>
                    <div
                        className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            enabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={() => setEnabled((v) => !v)}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                enabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {providers.map((provider, index) => (
                    <div
                        key={index}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {provider.name ||
                                    t(
                                        'profile.oidcNewProvider',
                                        'New provider'
                                    )}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeProvider(index)}
                                className="text-gray-400 hover:text-red-500"
                                aria-label={t(
                                    'profile.oidcRemoveProvider',
                                    'Remove provider'
                                )}
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <LabeledInput
                                label={t('profile.oidcProviderName', 'Name')}
                                value={provider.name}
                                onChange={(v) =>
                                    updateProvider(index, { name: v })
                                }
                            />
                            <LabeledInput
                                label={t('profile.oidcProviderSlug', 'Slug')}
                                value={provider.slug}
                                onChange={(v) =>
                                    updateProvider(index, { slug: v })
                                }
                            />
                            <LabeledInput
                                label={t(
                                    'profile.oidcProviderIssuer',
                                    'Issuer URL'
                                )}
                                value={provider.issuer}
                                onChange={(v) =>
                                    updateProvider(index, { issuer: v })
                                }
                                className="sm:col-span-2"
                            />
                            <LabeledInput
                                label={t(
                                    'profile.oidcProviderClientId',
                                    'Client ID'
                                )}
                                value={provider.clientId}
                                onChange={(v) =>
                                    updateProvider(index, { clientId: v })
                                }
                            />
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {t(
                                        'profile.oidcProviderClientSecret',
                                        'Client secret'
                                    )}
                                </label>
                                <input
                                    type="password"
                                    value={provider.clientSecret || ''}
                                    onChange={(e) =>
                                        updateProvider(index, {
                                            clientSecret: e.target.value,
                                        })
                                    }
                                    placeholder={
                                        provider.client_secret_set
                                            ? t(
                                                  'profile.oidcSecretSet',
                                                  'Set (••••{{last4}}) — leave blank to keep',
                                                  {
                                                      last4:
                                                          provider.client_secret_last4 ||
                                                          '',
                                                  }
                                              )
                                            : t(
                                                  'profile.oidcSecretNotSet',
                                                  'Required'
                                              )
                                    }
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <LabeledInput
                                label={t('profile.oidcProviderScope', 'Scope')}
                                value={provider.scope}
                                onChange={(v) =>
                                    updateProvider(index, { scope: v })
                                }
                            />
                            <LabeledInput
                                label={t(
                                    'profile.oidcProviderAdminDomains',
                                    'Admin email domains (comma-separated)'
                                )}
                                value={provider.adminEmailDomainsText}
                                onChange={(v) =>
                                    updateProvider(index, {
                                        adminEmailDomainsText: v,
                                    })
                                }
                            />
                        </div>

                        <div className="flex items-center mt-3">
                            <input
                                type="checkbox"
                                id={`oidc-auto-provision-${index}`}
                                checked={provider.autoProvision}
                                onChange={(e) =>
                                    updateProvider(index, {
                                        autoProvision: e.target.checked,
                                    })
                                }
                                className="mr-2"
                            />
                            <label
                                htmlFor={`oidc-auto-provision-${index}`}
                                className="text-sm text-gray-600 dark:text-gray-400"
                            >
                                {t(
                                    'profile.oidcAutoProvision',
                                    'Auto-provision new users'
                                )}
                            </label>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between mt-4">
                <button
                    type="button"
                    onClick={addProvider}
                    className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    {t('profile.oidcAddProvider', 'Add provider')}
                </button>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving
                        ? t('profile.saving', 'Saving...')
                        : t('profile.saveChanges', 'Save changes')}
                </button>
            </div>
        </div>
    );
};

export default OidcProviderConfig;
