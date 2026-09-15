import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ClipboardDocumentListIcon,
    LinkIcon,
    TrashIcon,
    ArrowPathIcon,
    PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import type {
    WebhookEndpointSummary,
    WebhookAuthType,
} from '../../../utils/webhooksService';

export const WEBHOOK_EVENT_TYPES: {
    value: string;
    labelKey: string;
    defaultLabel: string;
}[] = [
    {
        value: 'task_due_soon',
        labelKey: 'notifications.types.dueTasks',
        defaultLabel: 'Due Tasks',
    },
    {
        value: 'task_overdue',
        labelKey: 'notifications.types.overdueTasks',
        defaultLabel: 'Overdue Tasks',
    },
    {
        value: 'task_assigned',
        labelKey: 'notifications.types.taskAssigned',
        defaultLabel: 'Task Assigned',
    },
    {
        value: 'project_due_soon',
        labelKey: 'notifications.types.dueProjects',
        defaultLabel: 'Due Projects',
    },
    {
        value: 'project_overdue',
        labelKey: 'notifications.types.overdueProjects',
        defaultLabel: 'Overdue Projects',
    },
    {
        value: 'share_invitation',
        labelKey: 'profile.webhooks.eventTypes.shareInvitation',
        defaultLabel: 'Share Invitation',
    },
];

interface WebhooksTabProps {
    isActive: boolean;
    webhooks: WebhookEndpointSummary[];
    webhooksLoading: boolean;
    generatedSecret: string | null;
    newWebhookName: string;
    newWebhookUrl: string;
    newWebhookEventTypes: string[];
    newWebhookAuthType: WebhookAuthType;
    newWebhookAuthHeaderName: string;
    newWebhookAuthUsername: string;
    newWebhookAuthSecret: string;
    isCreatingWebhook: boolean;
    testInFlightUid: string | null;
    rotateInFlightUid: string | null;
    deleteInFlightUid: string | null;
    onCreateWebhook: () => void;
    onCopyGeneratedSecret: () => void;
    onUpdateNewName: (value: string) => void;
    onUpdateNewUrl: (value: string) => void;
    onToggleNewEventType: (eventType: string) => void;
    onUpdateNewAuthType: (value: WebhookAuthType) => void;
    onUpdateNewAuthHeaderName: (value: string) => void;
    onUpdateNewAuthUsername: (value: string) => void;
    onUpdateNewAuthSecret: (value: string) => void;
    onToggleActive: (webhook: WebhookEndpointSummary) => void;
    onTest: (webhook: WebhookEndpointSummary) => void;
    onRotateSecret: (webhook: WebhookEndpointSummary) => void;
    onRequestDelete: (webhook: WebhookEndpointSummary) => void;
    formatDateTime: (value: string | null) => string;
}

const WebhooksTab: React.FC<WebhooksTabProps> = ({
    isActive,
    webhooks,
    webhooksLoading,
    generatedSecret,
    newWebhookName,
    newWebhookUrl,
    newWebhookEventTypes,
    newWebhookAuthType,
    newWebhookAuthHeaderName,
    newWebhookAuthUsername,
    newWebhookAuthSecret,
    isCreatingWebhook,
    testInFlightUid,
    rotateInFlightUid,
    deleteInFlightUid,
    onCreateWebhook,
    onCopyGeneratedSecret,
    onUpdateNewName,
    onUpdateNewUrl,
    onToggleNewEventType,
    onUpdateNewAuthType,
    onUpdateNewAuthHeaderName,
    onUpdateNewAuthUsername,
    onUpdateNewAuthSecret,
    onToggleActive,
    onTest,
    onRotateSecret,
    onRequestDelete,
    formatDateTime,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <LinkIcon className="w-6 h-6 mr-3 text-indigo-500" />
                {t('profile.webhooks.title', 'Webhooks')}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {t(
                    'profile.webhooks.description',
                    'Send your notifications as signed HTTP requests to your own endpoints (Zapier, n8n, a custom integration...). Leave event types unchecked to receive every notification type.'
                )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.webhooks.nameLabel', 'Name')}
                    </label>
                    <input
                        type="text"
                        value={newWebhookName}
                        onChange={(event) =>
                            onUpdateNewName(event.target.value)
                        }
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t(
                            'profile.webhooks.namePlaceholder',
                            'e.g. My Zapier integration'
                        )}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.webhooks.urlLabel', 'Endpoint URL')}
                    </label>
                    <input
                        type="text"
                        value={newWebhookUrl}
                        onChange={(event) => onUpdateNewUrl(event.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/webhook"
                    />
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('profile.webhooks.eventTypesLabel', 'Event types')}
                </label>
                <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENT_TYPES.map((eventType) => {
                        const selected = newWebhookEventTypes.includes(
                            eventType.value
                        );
                        return (
                            <button
                                key={eventType.value}
                                type="button"
                                onClick={() =>
                                    onToggleNewEventType(eventType.value)
                                }
                                className={`px-3 py-1.5 text-sm rounded-full ${
                                    selected
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {t(eventType.labelKey, eventType.defaultLabel)}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {newWebhookEventTypes.length === 0
                        ? t(
                              'profile.webhooks.allEventTypes',
                              'No types selected: this endpoint will receive every notification type.'
                          )
                        : null}
                </p>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('profile.webhooks.authLabel', 'Authentication')}
                </label>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'profile.webhooks.authDescription',
                        'Every delivery is always signed with X-Tududi-Signature. Set this only if your receiver (e.g. n8n, Zapier) additionally requires its own authentication to accept the request.'
                    )}
                </p>
                <select
                    value={newWebhookAuthType}
                    onChange={(event) =>
                        onUpdateNewAuthType(
                            event.target.value as WebhookAuthType
                        )
                    }
                    className="block w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="none">
                        {t('profile.webhooks.auth.none', 'None')}
                    </option>
                    <option value="header">
                        {t('profile.webhooks.auth.header', 'Header Auth')}
                    </option>
                    <option value="basic">
                        {t('profile.webhooks.auth.basic', 'Basic Auth')}
                    </option>
                </select>

                {newWebhookAuthType === 'header' && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.webhooks.authHeaderNameLabel',
                                    'Header name'
                                )}
                            </label>
                            <input
                                type="text"
                                value={newWebhookAuthHeaderName}
                                onChange={(event) =>
                                    onUpdateNewAuthHeaderName(
                                        event.target.value
                                    )
                                }
                                placeholder="Authorization"
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.webhooks.authHeaderValueLabel',
                                    'Header value'
                                )}
                            </label>
                            <input
                                type="password"
                                value={newWebhookAuthSecret}
                                onChange={(event) =>
                                    onUpdateNewAuthSecret(event.target.value)
                                }
                                placeholder={t(
                                    'profile.webhooks.authHeaderValuePlaceholder',
                                    'e.g. a bearer token or API key'
                                )}
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}

                {newWebhookAuthType === 'basic' && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.webhooks.authUsernameLabel',
                                    'Username'
                                )}
                            </label>
                            <input
                                type="text"
                                value={newWebhookAuthUsername}
                                onChange={(event) =>
                                    onUpdateNewAuthUsername(event.target.value)
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.webhooks.authPasswordLabel',
                                    'Password'
                                )}
                            </label>
                            <input
                                type="password"
                                value={newWebhookAuthSecret}
                                onChange={(event) =>
                                    onUpdateNewAuthSecret(event.target.value)
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-4">
                <button
                    type="button"
                    disabled={isCreatingWebhook}
                    onClick={onCreateWebhook}
                    className={`inline-flex justify-center items-center px-4 py-2 rounded-md text-white ${
                        isCreatingWebhook
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                >
                    {isCreatingWebhook
                        ? t('common.saving', 'Saving...')
                        : t('profile.webhooks.createButton', 'Add webhook')}
                </button>
            </div>

            {generatedSecret && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-md">
                    <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                        {t(
                            'profile.webhooks.copyNotice',
                            'Copy this signing secret now. It will not be shown again.'
                        )}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <code className="flex-1 bg-white dark:bg-gray-900 rounded px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-100 overflow-x-auto">
                            {generatedSecret}
                        </code>
                        <button
                            type="button"
                            onClick={onCopyGeneratedSecret}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-500"
                        >
                            <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                            {t('profile.webhooks.copyButton', 'Copy secret')}
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-6">
                {webhooksLoading && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('profile.webhooks.loading', 'Loading webhooks...')}
                    </p>
                )}

                {!webhooksLoading && webhooks.length === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'profile.webhooks.empty',
                            'No webhooks yet. Add one to start receiving notifications.'
                        )}
                    </p>
                )}

                {!webhooksLoading && webhooks.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.webhooks.table.name',
                                            'Name'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.webhooks.table.status',
                                            'Status'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.webhooks.table.lastDelivery',
                                            'Last delivery'
                                        )}
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t(
                                            'profile.webhooks.table.actions',
                                            'Actions'
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {webhooks.map((webhook) => (
                                    <tr key={webhook.uid}>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {webhook.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">
                                                {webhook.url}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {webhook.event_types.length ===
                                                0
                                                    ? t(
                                                          'profile.webhooks.allEventsLabel',
                                                          'All events'
                                                      )
                                                    : webhook.event_types.join(
                                                          ', '
                                                      )}
                                            </div>
                                            {webhook.auth_type !== 'none' && (
                                                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                    {webhook.auth_type ===
                                                    'basic'
                                                        ? t(
                                                              'profile.webhooks.auth.basic',
                                                              'Basic Auth'
                                                          )
                                                        : t(
                                                              'profile.webhooks.auth.header',
                                                              'Header Auth'
                                                          )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onToggleActive(webhook)
                                                }
                                                className={
                                                    webhook.active
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-gray-400 dark:text-gray-500'
                                                }
                                            >
                                                {webhook.active
                                                    ? t(
                                                          'profile.webhooks.status.active',
                                                          'Active'
                                                      )
                                                    : t(
                                                          'profile.webhooks.status.disabled',
                                                          'Disabled'
                                                      )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                                            {webhook.last_delivery_at ? (
                                                <span
                                                    className={
                                                        webhook.last_delivery_status ===
                                                        'success'
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }
                                                >
                                                    {formatDateTime(
                                                        webhook.last_delivery_at
                                                    )}
                                                </span>
                                            ) : (
                                                t(
                                                    'profile.webhooks.never',
                                                    'Never'
                                                )
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onTest(webhook)
                                                    }
                                                    disabled={
                                                        testInFlightUid ===
                                                        webhook.uid
                                                    }
                                                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-medium"
                                                    aria-label={t(
                                                        'profile.webhooks.testAria',
                                                        'Send test delivery'
                                                    )}
                                                >
                                                    <PaperAirplaneIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onRotateSecret(webhook)
                                                    }
                                                    disabled={
                                                        rotateInFlightUid ===
                                                        webhook.uid
                                                    }
                                                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-yellow-600 text-yellow-700 hover:bg-yellow-50 text-xs font-medium"
                                                    aria-label={t(
                                                        'profile.webhooks.rotateAria',
                                                        'Rotate secret'
                                                    )}
                                                >
                                                    <ArrowPathIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onRequestDelete(webhook)
                                                    }
                                                    disabled={
                                                        deleteInFlightUid ===
                                                        webhook.uid
                                                    }
                                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-red-600 text-red-700 hover:bg-red-50 text-xs font-medium"
                                                    aria-label={t(
                                                        'profile.webhooks.deleteAria',
                                                        'Delete webhook'
                                                    )}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebhooksTab;
