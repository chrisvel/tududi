import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import {
    fetchCalendars,
    syncCalendar,
    deleteCalendar,
    type CalDAVCalendar,
} from '../../../utils/caldavService';
import CalendarCard from '../../CalDAV/CalendarCard';
import CalendarForm from '../../CalDAV/CalendarForm';
import ConflictResolver from '../../CalDAV/ConflictResolver';
import ConfirmDialog from '../../Shared/ConfirmDialog';

interface CalDAVTabProps {
    isActive: boolean;
}

const CalDAVTab: React.FC<CalDAVTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [calendars, setCalendars] = useState<CalDAVCalendar[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedCalendarForConflicts, setSelectedCalendarForConflicts] =
        useState<number | null>(null);
    const [calendarToDelete, setCalendarToDelete] =
        useState<CalDAVCalendar | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [syncingId, setSyncingId] = useState<number | null>(null);

    const loadCalendars = async () => {
        setIsLoading(true);
        try {
            const data = await fetchCalendars();
            setCalendars(data);
        } catch {
            showErrorToast(
                t(
                    'profile.caldav.loadError',
                    'Failed to load CalDAV calendars'
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            loadCalendars();
        }
    }, [isActive]);

    const handleSyncCalendar = async (calendarId: number) => {
        setSyncingId(calendarId);
        try {
            await syncCalendar(calendarId, { dryRun: false });
            showSuccessToast(
                t('profile.caldav.syncSuccess', 'Calendar synced successfully')
            );
            await loadCalendars();
        } catch {
            showErrorToast(
                t(
                    'profile.caldav.syncError',
                    'Failed to sync calendar'
                )
            );
        } finally {
            setSyncingId(null);
        }
    };

    const handleDeleteCalendar = async () => {
        if (!calendarToDelete) return;

        setDeletingId(calendarToDelete.id);
        try {
            await deleteCalendar(calendarToDelete.id);
            showSuccessToast(
                t(
                    'profile.caldav.deleteSuccess',
                    'Calendar deleted successfully'
                )
            );
            await loadCalendars();
            setCalendarToDelete(null);
        } catch {
            showErrorToast(
                t(
                    'profile.caldav.deleteError',
                    'Failed to delete calendar'
                )
            );
        } finally {
            setDeletingId(null);
        }
    };

    const handleFormComplete = async () => {
        setShowForm(false);
        await loadCalendars();
    };

    const handleViewConflicts = (calendarId: number) => {
        setSelectedCalendarForConflicts(calendarId);
    };

    const handleConflictsResolved = async () => {
        setSelectedCalendarForConflicts(null);
        await loadCalendars();
    };

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CalendarIcon className="w-6 h-6 mr-3 text-indigo-500" />
                {t('profile.caldav.title', 'CalDAV Synchronization')}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {t(
                    'profile.caldav.description',
                    'Sync your tasks with external CalDAV servers like Nextcloud, iCloud, or Radicale. Configure calendars, manage sync intervals, and resolve conflicts.'
                )}
            </p>

            {!showForm && calendars.length > 0 && (
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        {t('profile.caldav.calendars', 'Calendars')}
                    </h4>
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        {t('profile.caldav.addCalendar', 'Add Calendar')}
                    </button>
                </div>
            )}

            {showForm && (
                <div className="mb-6">
                    <CalendarForm
                        onComplete={handleFormComplete}
                        onCancel={() => setShowForm(false)}
                    />
                </div>
            )}

            {!showForm && (
                <>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : calendars.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                                {t('profile.caldav.noCalendars', 'No calendars')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {t(
                                    'profile.caldav.noCalendarsDescription',
                                    'Get started by creating a new CalDAV calendar.'
                                )}
                            </p>
                            <div className="mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(true)}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                                >
                                    <PlusIcon className="w-5 h-5 mr-2" />
                                    {t('profile.caldav.addCalendar', 'Add Calendar')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {calendars.map((calendar) => (
                                <CalendarCard
                                    key={calendar.id}
                                    calendar={calendar}
                                    onSync={handleSyncCalendar}
                                    onDelete={() => setCalendarToDelete(calendar)}
                                    onViewConflicts={handleViewConflicts}
                                    onUpdated={loadCalendars}
                                    isSyncing={syncingId === calendar.id}
                                    isDeleting={deletingId === calendar.id}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {selectedCalendarForConflicts !== null && (
                <ConflictResolver
                    isOpen={true}
                    calendarId={selectedCalendarForConflicts}
                    onClose={() => setSelectedCalendarForConflicts(null)}
                    onResolved={handleConflictsResolved}
                />
            )}

            {calendarToDelete && (
                <ConfirmDialog
                    title={t('profile.caldav.confirmDelete', 'Delete Calendar')}
                    message={t(
                        'profile.caldav.confirmDeleteMessage',
                        'Are you sure you want to delete "{{name}}"? This will remove the calendar and all sync configurations.',
                        { name: calendarToDelete.name }
                    )}
                    confirmButtonText={t('common.delete', 'Delete')}
                    onConfirm={handleDeleteCalendar}
                    onCancel={() => setCalendarToDelete(null)}
                />
            )}
        </div>
    );
};

export default CalDAVTab;
