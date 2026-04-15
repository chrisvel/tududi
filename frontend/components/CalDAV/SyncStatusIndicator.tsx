import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    MinusCircleIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/solid';

interface SyncStatusIndicatorProps {
    enabled: boolean;
    lastSyncStatus: string | null;
    isSyncing: boolean;
    hasConflicts: boolean;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
    enabled,
    lastSyncStatus,
    isSyncing,
    hasConflicts,
}) => {
    const { t } = useTranslation();

    if (!enabled) {
        return (
            <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                title={t('profile.caldav.disabled', 'Disabled')}
            >
                <MinusCircleIcon className="w-4 h-4 mr-1" />
                {t('profile.caldav.disabled', 'Disabled')}
            </span>
        );
    }

    if (isSyncing) {
        return (
            <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                title={t('profile.caldav.syncing', 'Syncing...')}
            >
                <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                {t('profile.caldav.syncing', 'Syncing...')}
            </span>
        );
    }

    if (hasConflicts) {
        return (
            <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                title={t('profile.caldav.hasConflicts', 'Has conflicts')}
            >
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                {t('profile.caldav.conflicts', 'Conflicts')}
            </span>
        );
    }

    if (lastSyncStatus === 'success') {
        return (
            <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                title={t('profile.caldav.syncSuccess', 'Synced successfully')}
            >
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                {t('profile.caldav.synced', 'Synced')}
            </span>
        );
    }

    if (lastSyncStatus === 'error' || lastSyncStatus === 'failed') {
        return (
            <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                title={t('profile.caldav.syncError', 'Sync failed')}
            >
                <XCircleIcon className="w-4 h-4 mr-1" />
                {t('profile.caldav.error', 'Error')}
            </span>
        );
    }

    return (
        <span
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            title={t('profile.caldav.neverSynced', 'Never synced')}
        >
            <MinusCircleIcon className="w-4 h-4 mr-1" />
            {t('profile.caldav.notSynced', 'Not synced')}
        </span>
    );
};

export default SyncStatusIndicator;
