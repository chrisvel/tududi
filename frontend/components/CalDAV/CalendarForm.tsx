import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import {
    createCalendar,
    createRemoteCalendar,
    testConnection,
} from '../../utils/caldavService';

interface CalendarFormProps {
    onComplete: () => void;
    onCancel: () => void;
}

const DEFAULT_COLORS = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
];

const CalendarForm: React.FC<CalendarFormProps> = ({ onComplete, onCancel }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [formData, setFormData] = useState({
        calendarName: '',
        calendarDescription: '',
        calendarColor: DEFAULT_COLORS[0],
        serverUrl: '',
        calendarPath: '',
        username: '',
        password: '',
        authType: 'basic' as 'basic' | 'bearer',
        syncDirection: 'bidirectional' as 'bidirectional' | 'pull' | 'push',
        syncInterval: 15,
        conflictResolution: 'manual' as 'last_write_wins' | 'local_wins' | 'remote_wins' | 'manual',
        enabled: true,
    });

    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.calendarName.trim()) {
            newErrors.calendarName = t(
                'profile.caldavWizard.calendarNameRequired',
                'Calendar name is required'
            );
        }

        if (!formData.serverUrl.trim()) {
            newErrors.serverUrl = t(
                'profile.caldavWizard.serverUrlRequired',
                'Server URL is required'
            );
        }

        if (!formData.calendarPath.trim()) {
            newErrors.calendarPath = t(
                'profile.caldavWizard.calendarPathRequired',
                'Calendar path is required'
            );
        }

        if (!formData.username.trim()) {
            newErrors.username = t(
                'profile.caldavWizard.credentialsRequired',
                'Username is required'
            );
        }

        if (!formData.password.trim()) {
            newErrors.password = t(
                'profile.caldavWizard.credentialsRequired',
                'Password is required'
            );
        }

        if (!testResult?.success) {
            newErrors.connection = t(
                'profile.caldavWizard.testRequired',
                'You must test the connection before saving'
            );
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleTestConnection = async () => {
        if (!formData.serverUrl.trim() || !formData.calendarPath.trim() ||
            !formData.username.trim() || !formData.password.trim()) {
            showErrorToast(t(
                'profile.caldavWizard.fillServerDetails',
                'Please fill in all server connection details first'
            ));
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        setErrors({});

        try {
            const result = await testConnection({
                server_url: formData.serverUrl,
                calendar_path: formData.calendarPath,
                username: formData.username,
                password: formData.password,
            });

            setTestResult({
                success: result.success && result.supportsCalDAV,
                message: result.message,
            });

            if (result.success && result.supportsCalDAV) {
                showSuccessToast(
                    t(
                        'profile.caldavWizard.connectionSuccess',
                        'Connection successful!'
                    )
                );
            } else {
                showErrorToast(result.message);
            }
        } catch (err: any) {
            const message =
                err.message ||
                t(
                    'profile.caldavWizard.connectionFailed',
                    'Failed to connect to server'
                );
            setTestResult({ success: false, message });
            showErrorToast(message);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!validateForm()) {
            showErrorToast(
                t(
                    'profile.caldavWizard.validationError',
                    'Please fill in all required fields and test the connection'
                )
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const calendar = await createCalendar({
                name: formData.calendarName,
                description: formData.calendarDescription || null,
                color: formData.calendarColor,
                enabled: formData.enabled,
                sync_direction: formData.syncDirection,
                sync_interval_minutes: formData.syncInterval,
                conflict_resolution: formData.conflictResolution,
            });

            await createRemoteCalendar({
                local_calendar_id: calendar.id,
                name: formData.calendarName,
                server_url: formData.serverUrl,
                calendar_path: formData.calendarPath,
                username: formData.username,
                password: formData.password,
                auth_type: formData.authType,
            });

            showSuccessToast(
                t(
                    'profile.caldavWizard.setupSuccess',
                    'Calendar configured successfully!'
                )
            );

            onComplete();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t(
                        'profile.caldavWizard.setupFailed',
                        'Failed to create calendar'
                    )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('profile.caldavWizard.calendarSettings', 'Calendar Settings')}
                    </h4>
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.calendarName', 'Calendar name')}{' '}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.calendarName}
                        onChange={(e) => {
                            setFormData({ ...formData, calendarName: e.target.value });
                            setErrors({ ...errors, calendarName: '' });
                        }}
                        className={`block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                            errors.calendarName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder={t('profile.caldavWizard.calendarNamePlaceholder', 'e.g., Work Tasks')}
                    />
                    {errors.calendarName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.calendarName}</p>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.description', 'Description')}{' '}
                        <span className="text-gray-400 text-xs">
                            ({t('common.optional', 'optional')})
                        </span>
                    </label>
                    <textarea
                        value={formData.calendarDescription}
                        onChange={(e) =>
                            setFormData({ ...formData, calendarDescription: e.target.value })
                        }
                        rows={2}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder={t('profile.caldavWizard.descriptionPlaceholder', 'Optional description')}
                    />
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.caldavWizard.color', 'Color')}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {DEFAULT_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setFormData({ ...formData, calendarColor: color })}
                                className={`w-10 h-10 rounded-full border-4 transition-all ${
                                    formData.calendarColor === color
                                        ? 'border-gray-400 dark:border-gray-500 scale-110'
                                        : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('profile.caldavWizard.serverSettings', 'Server Settings')}
                    </h4>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.serverUrl', 'Server URL')}{' '}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="url"
                        value={formData.serverUrl}
                        onChange={(e) => {
                            setFormData({ ...formData, serverUrl: e.target.value });
                            setErrors({ ...errors, serverUrl: '' });
                            setTestResult(null);
                        }}
                        className={`block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                            errors.serverUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="https://caldav.example.com"
                    />
                    {errors.serverUrl && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.serverUrl}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.calendarPath', 'Calendar path')}{' '}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.calendarPath}
                        onChange={(e) => {
                            setFormData({ ...formData, calendarPath: e.target.value });
                            setErrors({ ...errors, calendarPath: '' });
                            setTestResult(null);
                        }}
                        className={`block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                            errors.calendarPath ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="/calendars/user/tasks"
                    />
                    {errors.calendarPath && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.calendarPath}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.username', 'Username')}{' '}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => {
                            setFormData({ ...formData, username: e.target.value });
                            setErrors({ ...errors, username: '' });
                            setTestResult(null);
                        }}
                        className={`block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                            errors.username ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        autoComplete="username"
                    />
                    {errors.username && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.username}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.password', 'Password')}{' '}
                        <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            setErrors({ ...errors, password: '' });
                            setTestResult(null);
                        }}
                        className={`block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                            errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        autoComplete="current-password"
                    />
                    {errors.password && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.authType', 'Authentication type')}
                    </label>
                    <select
                        value={formData.authType}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                authType: e.target.value as 'basic' | 'bearer',
                            })
                        }
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="basic">
                            {t('profile.caldavWizard.basicAuth', 'Basic Auth')}
                        </option>
                        <option value="bearer">
                            {t('profile.caldavWizard.bearerAuth', 'Bearer Token')}
                        </option>
                    </select>
                </div>

                <div className="lg:col-span-2">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className={`w-full inline-flex justify-center items-center px-4 py-2 rounded-md text-white font-medium ${
                            isTesting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500'
                        }`}
                    >
                        {isTesting
                            ? t('profile.caldavWizard.testing', 'Testing...')
                            : t('profile.caldavWizard.testConnection', 'Test Connection')}
                    </button>

                    {testResult && (
                        <div
                            className={`mt-3 p-3 rounded-lg ${
                                testResult.success
                                    ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                                    : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
                            }`}
                        >
                            <p
                                className={`text-sm ${
                                    testResult.success
                                        ? 'text-green-800 dark:text-green-200'
                                        : 'text-red-800 dark:text-red-200'
                                }`}
                            >
                                {testResult.message}
                            </p>
                        </div>
                    )}

                    {errors.connection && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.connection}</p>
                    )}
                </div>

                <div className="lg:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('profile.caldavWizard.syncSettings', 'Sync Settings')}
                    </h4>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.syncDirection', 'Sync direction')}
                    </label>
                    <select
                        value={formData.syncDirection}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                syncDirection: e.target.value as 'bidirectional' | 'pull' | 'push',
                            })
                        }
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="bidirectional">
                            {t('profile.caldavWizard.bidirectional', 'Bidirectional (sync both ways)')}
                        </option>
                        <option value="pull">
                            {t('profile.caldavWizard.pullOnly', 'Pull only (from server to TaskNoteTaker)')}
                        </option>
                        <option value="push">
                            {t('profile.caldavWizard.pushOnly', 'Push only (from TaskNoteTaker to server)')}
                        </option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.syncInterval', 'Sync interval (minutes)')}
                    </label>
                    <input
                        type="number"
                        min="5"
                        max="1440"
                        value={formData.syncInterval}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                syncInterval: parseInt(e.target.value),
                            })
                        }
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('profile.caldavWizard.syncIntervalHelp', 'How often to automatically sync (5-1440 minutes)')}
                    </p>
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('profile.caldavWizard.conflictPolicy', 'Conflict resolution')}
                    </label>
                    <select
                        value={formData.conflictResolution}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                conflictResolution: e.target.value as
                                    | 'last_write_wins'
                                    | 'local_wins'
                                    | 'remote_wins'
                                    | 'manual',
                            })
                        }
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="manual">
                            {t('profile.caldavWizard.manual', 'Ask me (manual resolution)')}
                        </option>
                        <option value="last_write_wins">
                            {t('profile.caldavWizard.lastWriteWins', 'Last modified wins (automatic)')}
                        </option>
                        <option value="local_wins">
                            {t('profile.caldavWizard.localWins', 'Local always wins')}
                        </option>
                        <option value="remote_wins">
                            {t('profile.caldavWizard.remoteWins', 'Remote always wins')}
                        </option>
                    </select>
                </div>

                <div className="lg:col-span-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.enabled}
                            onChange={(e) =>
                                setFormData({ ...formData, enabled: e.target.checked })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('profile.editCalendar.enableSync', 'Enable synchronization')}
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 transition-colors"
                >
                    {t('common.cancel', 'Cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleCreateClick}
                    disabled={isSubmitting}
                    className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
                        isSubmitting
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                >
                    {isSubmitting
                        ? t('common.creating', 'Creating...')
                        : t('common.createCalendar', 'Create Calendar')}
                </button>
            </div>
        </form>
    );
};

export default CalendarForm;
