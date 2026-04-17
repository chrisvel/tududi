import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowPathIcon,
    Cog6ToothIcon,
    TrashIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { CalDAVCalendar } from '../../utils/caldavService';
import SyncStatusIndicator from './SyncStatusIndicator';
import EditCalendarModal from './EditCalendarModal';
import { formatDistanceToNow } from 'date-fns';

interface CalendarCardProps {
    calendar: CalDAVCalendar;
    onSync: (calendarId: number) => void;
    onDelete: (calendarId: number) => void;
    onViewConflicts: (calendarId: number) => void;
    onUpdated: () => void;
    isSyncing: boolean;
    isDeleting: boolean;
}

const CalendarCard: React.FC<CalendarCardProps> = ({
    calendar,
    onSync,
    onDelete,
    onViewConflicts,
    onUpdated,
    isSyncing,
    isDeleting,
}) => {
    const { t } = useTranslation();
    const [showEditModal, setShowEditModal] = useState(false);

    const formatLastSync = (lastSyncAt: string | null) => {
        if (!lastSyncAt) {
            return t('profile.caldav.neverSynced', 'Never synced');
        }
        try {
            return formatDistanceToNow(new Date(lastSyncAt), {
                addSuffix: true,
            });
        } catch {
            return t('profile.caldav.neverSynced', 'Never synced');
        }
    };

    const getSyncDirectionLabel = () => {
        switch (calendar.sync_direction) {
            case 'bidirectional':
                return t('profile.caldav.bidirectional', 'Bidirectional');
            case 'pull':
                return t('profile.caldav.pullOnly', 'Pull only');
            case 'push':
                return t('profile.caldav.pushOnly', 'Push only');
            default:
                return calendar.sync_direction;
        }
    };

    const hasConflicts =
        calendar.stats && calendar.stats.conflicts > 0;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div
                            className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600"
                            style={{
                                backgroundColor: calendar.color || '#3b82f6',
                            }}
                        />
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {calendar.name}
                        </h4>
                        <SyncStatusIndicator
                            enabled={calendar.enabled}
                            lastSyncStatus={calendar.last_sync_status}
                            isSyncing={isSyncing}
                            hasConflicts={hasConflicts}
                        />
                    </div>

                    {calendar.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {calendar.description}
                        </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('profile.caldav.lastSync', 'Last sync')}:
                            </span>
                            <p className="text-gray-900 dark:text-white font-medium">
                                {formatLastSync(calendar.last_sync_at)}
                            </p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('profile.caldav.interval', 'Interval')}:
                            </span>
                            <p className="text-gray-900 dark:text-white font-medium">
                                {calendar.sync_interval_minutes}{' '}
                                {t('profile.caldav.minutes', 'min')}
                            </p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('profile.caldav.direction', 'Direction')}:
                            </span>
                            <p className="text-gray-900 dark:text-white font-medium">
                                {getSyncDirectionLabel()}
                            </p>
                        </div>
                        {calendar.stats && (
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t('profile.caldav.tasks', 'Tasks')}:
                                </span>
                                <p className="text-gray-900 dark:text-white font-medium">
                                    {calendar.stats.synced} /{' '}
                                    {calendar.stats.total}
                                </p>
                            </div>
                        )}
                    </div>

                    {hasConflicts && (
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => onViewConflicts(calendar.id)}
                                className="inline-flex items-center px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-md text-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                            >
                                <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                                {t(
                                    'profile.caldav.conflictsCount',
                                    '{{count}} conflict(s)',
                                    { count: calendar.stats.conflicts }
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                    <button
                        type="button"
                        onClick={() => onSync(calendar.id)}
                        disabled={isSyncing || !calendar.enabled}
                        className={`p-2 rounded-md transition-colors ${
                            isSyncing || !calendar.enabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                        title={t('profile.caldav.syncNow', 'Sync now')}
                    >
                        <ArrowPathIcon
                            className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t('profile.caldav.edit', 'Edit')}
                    >
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(calendar.id)}
                        disabled={isDeleting}
                        className={`p-2 rounded-md transition-colors ${
                            isDeleting
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={t('profile.caldav.delete', 'Delete')}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {showEditModal && (
                <EditCalendarModal
                    isOpen={showEditModal}
                    calendar={calendar}
                    onClose={() => setShowEditModal(false)}
                    onSaved={() => {
                        setShowEditModal(false);
                        onUpdated();
                    }}
                />
            )}
        </div>
    );
};

export default CalendarCard;
