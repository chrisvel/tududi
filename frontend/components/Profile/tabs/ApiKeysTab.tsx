import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ClipboardDocumentListIcon,
    KeyIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import type { ApiKeySummary } from '../../../utils/apiKeysService';

interface ApiKeysTabProps {
    isActive: boolean;
    apiKeys: ApiKeySummary[];
    apiKeysLoading: boolean;
    generatedApiToken: string | null;
    newApiKeyName: string;
    newApiKeyExpiration: string;
    revokeInFlightId: number | null;
    deleteInFlightId: number | null;
    pendingDeleteId: number | null;
    onCreateApiKey: () => void;
    onCopyGeneratedToken: () => void;
    onRevokeApiKey: (apiKeyId: number) => void;
    onRequestDelete: (apiKey: ApiKeySummary) => void;
    onUpdateNewName: (value: string) => void;
    onUpdateNewExpiration: (value: string) => void;
    getApiKeyStatus: (apiKey: ApiKeySummary) => {
        label: string;
        className: string;
    };
    formatDateTime: (value: string | null) => string;
    isCreatingApiKey: boolean;
}

const ApiKeysTab: React.FC<ApiKeysTabProps> = ({
    isActive,
    apiKeys,
    apiKeysLoading,
    generatedApiToken,
    newApiKeyName,
    newApiKeyExpiration,
    revokeInFlightId,
    deleteInFlightId,
    pendingDeleteId,
    onCreateApiKey,
    onCopyGeneratedToken,
    onRevokeApiKey,
    onRequestDelete,
    onUpdateNewName,
    onUpdateNewExpiration,
    getApiKeyStatus,
    formatDateTime,
    isCreatingApiKey,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <KeyIcon className="w-6 h-6 mr-3 text-indigo-500" />
                {t('profile.apiKeys.title', 'API Keys')}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {t(
                    'profile.apiKeys.description',
                    'Generate personal access tokens for integrations or CLI usage. You can revoke or delete keys at any time.'
                )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.apiKeys.nameLabel', 'Key name')}
                    </label>
                    <input
                        type="text"
                        value={newApiKeyName}
                        onChange={(event) =>
                            onUpdateNewName(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onCreateApiKey();
                            }
                        }}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t(
                            'profile.apiKeys.namePlaceholder',
                            'e.g. Personal laptop'
                        )}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t(
                            'profile.apiKeys.expirationLabel',
                            'Expires on (optional)'
                        )}
                    </label>
                    <input
                        type="date"
                        value={newApiKeyExpiration}
                        onChange={(event) =>
                            onUpdateNewExpiration(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onCreateApiKey();
                            }
                        }}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        type="button"
                        disabled={isCreatingApiKey}
                        onClick={onCreateApiKey}
                        className={`w-full inline-flex justify-center items-center px-4 py-2 rounded-md text-white ${
                            isCreatingApiKey
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                    >
                        {isCreatingApiKey
                            ? t('common.saving', 'Saving...')
                            : t(
                                  'profile.apiKeys.generateButton',
                                  'Generate key'
                              )}
                    </button>
                </div>
            </div>

            {generatedApiToken && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-md">
                    <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                        {t(
                            'profile.apiKeys.copyNotice',
                            'Copy this token now. It will not be shown again.'
                        )}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <code className="flex-1 bg-white dark:bg-gray-900 rounded px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-100 overflow-x-auto">
                            {generatedApiToken}
                        </code>
                        <button
                            type="button"
                            onClick={onCopyGeneratedToken}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-500"
                        >
                            <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                            {t('profile.apiKeys.copyButton', 'Copy key')}
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-6">
                {apiKeysLoading && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('profile.apiKeys.loading', 'Loading API keys...')}
                    </p>
                )}

                {!apiKeysLoading && apiKeys.length === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'profile.apiKeys.empty',
                            'No API keys yet. Generate one to begin.'
                        )}
                    </p>
                )}

                {!apiKeysLoading && apiKeys.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.name',
                                            'Name'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.prefix',
                                            'Prefix'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.status',
                                            'Status'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.lastUsed',
                                            'Last used'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.expires',
                                            'Expires'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.apiKeys.table.actions',
                                            'Actions'
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {apiKeys.map((key) => {
                                    const status = getApiKeyStatus(key);
                                    return (
                                        <tr key={key.id}>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {key.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {t(
                                                        'profile.apiKeys.createdAt',
                                                        'Created {{date}}',
                                                        {
                                                            date: formatDateTime(
                                                                key.created_at
                                                            ),
                                                        }
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-200">
                                                {key.token_prefix}...
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span
                                                    className={status.className}
                                                >
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                                                {formatDateTime(
                                                    key.last_used_at
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                                                {key.expires_at
                                                    ? formatDateTime(
                                                          key.expires_at
                                                      )
                                                    : t(
                                                          'profile.apiKeys.noExpiry',
                                                          'None'
                                                      )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm">
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onRevokeApiKey(
                                                                key.id
                                                            )
                                                        }
                                                        disabled={
                                                            Boolean(
                                                                key.revoked_at
                                                            ) ||
                                                            revokeInFlightId ===
                                                                key.id
                                                        }
                                                        className={`inline-flex items-center px-3 py-1.5 rounded-md border text-xs font-medium ${
                                                            key.revoked_at
                                                                ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                                                                : 'border-yellow-600 text-yellow-700 hover:bg-yellow-50'
                                                        }`}
                                                    >
                                                        {key.revoked_at
                                                            ? t(
                                                                  'profile.apiKeys.revokedLabel',
                                                                  'Revoked'
                                                              )
                                                            : t(
                                                                  'profile.apiKeys.revokeButton',
                                                                  'Revoke'
                                                              )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onRequestDelete(key)
                                                        }
                                                        disabled={
                                                            deleteInFlightId ===
                                                                key.id ||
                                                            Boolean(
                                                                pendingDeleteId ===
                                                                    key.id
                                                            )
                                                        }
                                                        className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md border text-xs font-medium ${
                                                            deleteInFlightId ===
                                                            key.id
                                                                ? 'border-gray-400 text-gray-400 cursor-not-allowed'
                                                                : 'border-red-600 text-red-700 hover:bg-red-50'
                                                        }`}
                                                        aria-label={t(
                                                            'profile.apiKeys.deleteAria',
                                                            'Delete API key'
                                                        )}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiKeysTab;
