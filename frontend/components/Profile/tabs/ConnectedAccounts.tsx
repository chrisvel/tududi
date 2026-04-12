import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LinkIcon,
    TrashIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
    fetchOIDCProviders,
    fetchOIDCIdentities,
    unlinkOIDCIdentity,
    initiateOIDCLink,
    type OIDCProvider,
    type OIDCIdentity,
} from '../../../utils/oidcService';

interface ConnectedAccountsProps {
    hasPassword: boolean;
}

const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
    hasPassword,
}) => {
    const { t } = useTranslation();
    const [providers, setProviders] = useState<OIDCProvider[]>([]);
    const [identities, setIdentities] = useState<OIDCIdentity[]>([]);
    const [loading, setLoading] = useState(true);
    const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
    const [confirmUnlinkId, setConfirmUnlinkId] = useState<number | null>(
        null
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [providersData, identitiesData] = await Promise.all([
                fetchOIDCProviders(),
                fetchOIDCIdentities(),
            ]);
            setProviders(providersData);
            setIdentities(identitiesData);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to load connected accounts'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleLinkProvider = async (providerSlug: string) => {
        try {
            setError(null);
            await initiateOIDCLink(providerSlug);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to initiate account linking'
            );
        }
    };

    const handleRequestUnlink = (identityId: number) => {
        setConfirmUnlinkId(identityId);
    };

    const handleCancelUnlink = () => {
        setConfirmUnlinkId(null);
    };

    const handleConfirmUnlink = async () => {
        if (!confirmUnlinkId) return;

        const canUnlink = hasPassword || identities.length > 1;
        if (!canUnlink) {
            setError(
                t(
                    'profile.connectedAccounts.cannotUnlinkLast',
                    'Cannot unlink your last authentication method. Please set a password first.'
                )
            );
            setConfirmUnlinkId(null);
            return;
        }

        try {
            setUnlinkingId(confirmUnlinkId);
            setError(null);
            await unlinkOIDCIdentity(confirmUnlinkId);
            await loadData();
            setConfirmUnlinkId(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to unlink account'
            );
        } finally {
            setUnlinkingId(null);
        }
    };

    const getProviderIdentity = (providerSlug: string): OIDCIdentity | null => {
        return (
            identities.find((id) => id.provider_slug === providerSlug) || null
        );
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (providers.length === 0 && !loading) {
        return null;
    }

    return (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-green-500" />
                {t('profile.connectedAccounts.title', 'Connected Accounts')}
            </h4>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t(
                    'profile.connectedAccounts.description',
                    'Link external accounts to sign in with SSO providers.'
                )}
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
                    <p className="text-sm flex items-center">
                        <ExclamationTriangleIcon className="w-4 h-4 inline mr-2" />
                        {error}
                    </p>
                </div>
            )}

            {loading ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </div>
            ) : (
                <div className="space-y-3">
                    {providers.map((provider) => {
                        const identity = getProviderIdentity(provider.slug);
                        const isLinked = identity !== null;

                        return (
                            <div
                                key={provider.slug}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {provider.name}
                                    </div>
                                    {isLinked && identity && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {identity.email && (
                                                <span>{identity.email}</span>
                                            )}
                                            {identity.first_login_at && (
                                                <span className="ml-2">
                                                    •{' '}
                                                    {t(
                                                        'profile.connectedAccounts.linkedOn',
                                                        'Linked on {{date}}',
                                                        {
                                                            date: formatDate(
                                                                identity.first_login_at
                                                            ),
                                                        }
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="ml-4">
                                    {isLinked ? (
                                        confirmUnlinkId === identity?.id ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleCancelUnlink}
                                                    className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                    disabled={
                                                        unlinkingId !== null
                                                    }
                                                >
                                                    {t(
                                                        'common.cancel',
                                                        'Cancel'
                                                    )}
                                                </button>
                                                <button
                                                    onClick={
                                                        handleConfirmUnlink
                                                    }
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                    disabled={
                                                        unlinkingId !== null
                                                    }
                                                >
                                                    {unlinkingId ===
                                                    identity?.id
                                                        ? t(
                                                              'common.unlinking',
                                                              'Unlinking...'
                                                          )
                                                        : t(
                                                              'profile.connectedAccounts.confirmUnlink',
                                                              'Confirm Unlink'
                                                          )}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    identity &&
                                                    handleRequestUnlink(
                                                        identity.id
                                                    )
                                                }
                                                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                                                disabled={unlinkingId !== null}
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                {t(
                                                    'profile.connectedAccounts.unlink',
                                                    'Unlink'
                                                )}
                                            </button>
                                        )
                                    ) : (
                                        <button
                                            onClick={() =>
                                                handleLinkProvider(
                                                    provider.slug
                                                )
                                            }
                                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            {t(
                                                'profile.connectedAccounts.link',
                                                'Link {{provider}}',
                                                { provider: provider.name }
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!hasPassword && identities.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200">
                    <p className="text-sm flex items-center">
                        <ExclamationTriangleIcon className="w-4 h-4 inline mr-2" />
                        {t(
                            'profile.connectedAccounts.noPasswordWarning',
                            'You have no password set. Consider setting one to have an alternative login method.'
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConnectedAccounts;
