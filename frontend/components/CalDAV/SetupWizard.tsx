import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    XMarkIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    createCalendar,
    createRemoteCalendar,
    testConnection,
} from '../../utils/caldavService';

interface SetupWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

interface WizardData {
    calendarName: string;
    calendarDescription: string;
    calendarColor: string;
    serverUrl: string;
    calendarPath: string;
    username: string;
    password: string;
    authType: 'basic' | 'bearer';
    syncDirection: 'bidirectional' | 'pull' | 'push';
    syncInterval: number;
    conflictResolution: 'last_write_wins' | 'local_wins' | 'remote_wins' | 'manual';
    enabled: boolean;
}

const STEPS = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'server', label: 'Server' },
    { id: 'test', label: 'Test' },
    { id: 'sync', label: 'Sync' },
    { id: 'review', label: 'Review' },
];

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

const SetupWizard: React.FC<SetupWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();

    const [currentStep, setCurrentStep] = useState(0);
    const [wizardData, setWizardData] = useState<WizardData>({
        calendarName: '',
        calendarDescription: '',
        calendarColor: DEFAULT_COLORS[0],
        serverUrl: '',
        calendarPath: '',
        username: '',
        password: '',
        authType: 'basic',
        syncDirection: 'bidirectional',
        syncInterval: 15,
        conflictResolution: 'manual',
        enabled: true,
    });
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleClose = () => {
        if (
            !isSubmitting &&
            (wizardData.calendarName ||
                wizardData.serverUrl ||
                wizardData.username)
        ) {
            if (
                confirm(
                    t(
                        'profile.caldavWizard.confirmClose',
                        'Are you sure you want to close? Your progress will be lost.'
                    )
                )
            ) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const validateStep = (): boolean => {
        setError('');

        switch (currentStep) {
            case 0:
                if (!wizardData.calendarName.trim()) {
                    setError(
                        t(
                            'profile.caldavWizard.calendarNameRequired',
                            'Calendar name is required'
                        )
                    );
                    return false;
                }
                return true;

            case 1:
                if (!wizardData.serverUrl.trim()) {
                    setError(
                        t(
                            'profile.caldavWizard.serverUrlRequired',
                            'Server URL is required'
                        )
                    );
                    return false;
                }
                if (!wizardData.calendarPath.trim()) {
                    setError(
                        t(
                            'profile.caldavWizard.calendarPathRequired',
                            'Calendar path is required'
                        )
                    );
                    return false;
                }
                if (!wizardData.username.trim() || !wizardData.password.trim()) {
                    setError(
                        t(
                            'profile.caldavWizard.credentialsRequired',
                            'Username and password are required'
                        )
                    );
                    return false;
                }
                return true;

            case 2:
                if (!testResult?.success) {
                    setError(
                        t(
                            'profile.caldavWizard.testRequired',
                            'You must test the connection before proceeding'
                        )
                    );
                    return false;
                }
                return true;

            case 3:
            case 4:
                return true;

            default:
                return true;
        }
    };

    const handleNext = () => {
        if (validateStep()) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
        }
    };

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        setError('');

        try {
            const result = await testConnection({
                server_url: wizardData.serverUrl,
                calendar_path: wizardData.calendarPath,
                username: wizardData.username,
                password: wizardData.password,
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
                setError(result.message);
            }
        } catch (err: any) {
            const message =
                err.message ||
                t(
                    'profile.caldavWizard.connectionFailed',
                    'Failed to connect to server'
                );
            setTestResult({ success: false, message });
            setError(message);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;

        setIsSubmitting(true);
        setError('');

        try {
            const calendar = await createCalendar({
                name: wizardData.calendarName,
                description: wizardData.calendarDescription || null,
                color: wizardData.calendarColor,
                enabled: wizardData.enabled,
                sync_direction: wizardData.syncDirection,
                sync_interval_minutes: wizardData.syncInterval,
                conflict_resolution: wizardData.conflictResolution,
            });

            await createRemoteCalendar({
                local_calendar_id: calendar.id,
                name: wizardData.calendarName,
                server_url: wizardData.serverUrl,
                calendar_path: wizardData.calendarPath,
                username: wizardData.username,
                password: wizardData.password,
                auth_type: wizardData.authType,
            });

            showSuccessToast(
                t(
                    'profile.caldavWizard.setupSuccess',
                    'Calendar configured successfully!'
                )
            );

            onComplete();
        } catch (err: any) {
            setError(
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

    if (!isOpen) return null;

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.calendarName',
                                    'Calendar name'
                                )}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={wizardData.calendarName}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        calendarName: e.target.value,
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder={t(
                                    'profile.caldavWizard.calendarNamePlaceholder',
                                    'e.g., Work Tasks'
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.description',
                                    'Description'
                                )}{' '}
                                <span className="text-gray-400 text-xs">
                                    ({t('common.optional', 'optional')})
                                </span>
                            </label>
                            <textarea
                                value={wizardData.calendarDescription}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        calendarDescription: e.target.value,
                                    })
                                }
                                rows={3}
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder={t(
                                    'profile.caldavWizard.descriptionPlaceholder',
                                    'Optional description'
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('profile.caldavWizard.color', 'Color')}
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {DEFAULT_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() =>
                                            setWizardData({
                                                ...wizardData,
                                                calendarColor: color,
                                            })
                                        }
                                        className={`w-10 h-10 rounded-full border-4 transition-all ${
                                            wizardData.calendarColor === color
                                                ? 'border-gray-400 dark:border-gray-500 scale-110'
                                                : 'border-transparent hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.serverUrl',
                                    'Server URL'
                                )}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="url"
                                value={wizardData.serverUrl}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        serverUrl: e.target.value,
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder="https://caldav.example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.calendarPath',
                                    'Calendar path'
                                )}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={wizardData.calendarPath}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        calendarPath: e.target.value,
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder="/calendars/user/tasks"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t(
                                        'profile.caldavWizard.username',
                                        'Username'
                                    )}{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={wizardData.username}
                                    onChange={(e) =>
                                        setWizardData({
                                            ...wizardData,
                                            username: e.target.value,
                                        })
                                    }
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    autoComplete="username"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t(
                                        'profile.caldavWizard.password',
                                        'Password'
                                    )}{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={wizardData.password}
                                    onChange={(e) =>
                                        setWizardData({
                                            ...wizardData,
                                            password: e.target.value,
                                        })
                                    }
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.authType',
                                    'Authentication type'
                                )}
                            </label>
                            <select
                                value={wizardData.authType}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        authType: e.target.value as
                                            | 'basic'
                                            | 'bearer',
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="basic">
                                    {t(
                                        'profile.caldavWizard.basicAuth',
                                        'Basic Auth'
                                    )}
                                </option>
                                <option value="bearer">
                                    {t(
                                        'profile.caldavWizard.bearerAuth',
                                        'Bearer Token'
                                    )}
                                </option>
                            </select>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'profile.caldavWizard.testDescription',
                                'Test the connection to your CalDAV server before proceeding.'
                            )}
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t(
                                        'profile.caldavWizard.server',
                                        'Server'
                                    )}
                                    :
                                </span>
                                <span className="text-gray-900 dark:text-white font-mono text-xs">
                                    {wizardData.serverUrl}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t('profile.caldavWizard.path', 'Path')}:
                                </span>
                                <span className="text-gray-900 dark:text-white font-mono text-xs">
                                    {wizardData.calendarPath}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t(
                                        'profile.caldavWizard.username',
                                        'Username'
                                    )}
                                    :
                                </span>
                                <span className="text-gray-900 dark:text-white">
                                    {wizardData.username}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className={`w-full inline-flex justify-center items-center px-4 py-3 rounded-md text-white font-medium ${
                                isTesting
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                        >
                            {isTesting
                                ? t('profile.caldavWizard.testing', 'Testing...')
                                : t(
                                      'profile.caldavWizard.testConnection',
                                      'Test Connection'
                                  )}
                        </button>

                        {testResult && (
                            <div
                                className={`p-4 rounded-lg ${
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
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.syncDirection',
                                    'Sync direction'
                                )}
                            </label>
                            <select
                                value={wizardData.syncDirection}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        syncDirection: e.target.value as
                                            | 'bidirectional'
                                            | 'pull'
                                            | 'push',
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="bidirectional">
                                    {t(
                                        'profile.caldavWizard.bidirectional',
                                        'Bidirectional (sync both ways)'
                                    )}
                                </option>
                                <option value="pull">
                                    {t(
                                        'profile.caldavWizard.pullOnly',
                                        'Pull only (from server to TaskNoteTaker)'
                                    )}
                                </option>
                                <option value="push">
                                    {t(
                                        'profile.caldavWizard.pushOnly',
                                        'Push only (from TaskNoteTaker to server)'
                                    )}
                                </option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.syncInterval',
                                    'Sync interval (minutes)'
                                )}
                            </label>
                            <input
                                type="number"
                                min="5"
                                max="1440"
                                value={wizardData.syncInterval}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        syncInterval: parseInt(e.target.value),
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'profile.caldavWizard.syncIntervalHelp',
                                    'How often to automatically sync (5-1440 minutes)'
                                )}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t(
                                    'profile.caldavWizard.conflictPolicy',
                                    'Conflict resolution'
                                )}
                            </label>
                            <select
                                value={wizardData.conflictResolution}
                                onChange={(e) =>
                                    setWizardData({
                                        ...wizardData,
                                        conflictResolution: e.target.value as
                                            | 'last_write_wins'
                                            | 'local_wins'
                                            | 'remote_wins'
                                            | 'manual',
                                    })
                                }
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="manual">
                                    {t(
                                        'profile.caldavWizard.manual',
                                        'Ask me (manual resolution)'
                                    )}
                                </option>
                                <option value="last_write_wins">
                                    {t(
                                        'profile.caldavWizard.lastWriteWins',
                                        'Last modified wins (automatic)'
                                    )}
                                </option>
                                <option value="local_wins">
                                    {t(
                                        'profile.caldavWizard.localWins',
                                        'Local always wins'
                                    )}
                                </option>
                                <option value="remote_wins">
                                    {t(
                                        'profile.caldavWizard.remoteWins',
                                        'Remote always wins'
                                    )}
                                </option>
                            </select>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'profile.caldavWizard.reviewDescription',
                                'Review your settings before creating the calendar.'
                            )}
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'profile.caldavWizard.calendarSettings',
                                        'Calendar Settings'
                                    )}
                                </h4>
                                <dl className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.name', 'Name')}:
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white font-medium">
                                            {wizardData.calendarName}
                                        </dd>
                                    </div>
                                    {wizardData.calendarDescription && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-600 dark:text-gray-400">
                                                {t(
                                                    'common.description',
                                                    'Description'
                                                )}
                                                :
                                            </dt>
                                            <dd className="text-gray-900 dark:text-white">
                                                {wizardData.calendarDescription}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'profile.caldavWizard.serverSettings',
                                        'Server Settings'
                                    )}
                                </h4>
                                <dl className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.server', 'Server')}:
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white font-mono text-xs">
                                            {wizardData.serverUrl}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.path', 'Path')}:
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white font-mono text-xs">
                                            {wizardData.calendarPath}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.username', 'Username')}:
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white">
                                            {wizardData.username}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'profile.caldavWizard.syncSettings',
                                        'Sync Settings'
                                    )}
                                </h4>
                                <dl className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t(
                                                'common.direction',
                                                'Direction'
                                            )}
                                            :
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white">
                                            {wizardData.syncDirection}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.interval', 'Interval')}:
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white">
                                            {wizardData.syncInterval} minutes
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-600 dark:text-gray-400">
                                            {t('common.conflicts', 'Conflicts')}
                                            :
                                        </dt>
                                        <dd className="text-gray-900 dark:text-white">
                                            {wizardData.conflictResolution}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {t(
                            'profile.caldavWizard.title',
                            'CalDAV Setup Wizard'
                        )}
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex items-center justify-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        {STEPS.map((step, index) => (
                            <React.Fragment key={step.id}>
                                <div
                                    className={`flex items-center gap-2 ${
                                        index === currentStep
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : index < currentStep
                                              ? 'text-green-600 dark:text-green-400'
                                              : 'text-gray-400 dark:text-gray-600'
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                            index === currentStep
                                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                                : index < currentStep
                                                  ? 'bg-green-100 dark:bg-green-900/30'
                                                  : 'bg-gray-100 dark:bg-gray-800'
                                        }`}
                                    >
                                        {index < currentStep ? (
                                            <CheckCircleIcon className="w-5 h-5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <span className="text-sm hidden sm:inline">
                                        {step.label}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {renderStepContent()}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {error}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={handlePrevious}
                        disabled={currentStep === 0 || isSubmitting}
                        className={`inline-flex items-center px-4 py-2 rounded-md ${
                            currentStep === 0 || isSubmitting
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        <ChevronLeftIcon className="w-5 h-5 mr-1" />
                        {t('common.previous', 'Previous')}
                    </button>

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={isSubmitting}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                        >
                            {t('common.next', 'Next')}
                            <ChevronRightIcon className="w-5 h-5 ml-1" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`inline-flex items-center px-4 py-2 rounded-md text-white ${
                                isSubmitting
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                            {isSubmitting
                                ? t('common.creating', 'Creating...')
                                : t('common.createCalendar', 'Create Calendar')}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SetupWizard;
