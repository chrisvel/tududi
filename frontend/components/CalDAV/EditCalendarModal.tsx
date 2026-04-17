import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    updateCalendar,
    type CalDAVCalendar,
} from '../../utils/caldavService';

interface EditCalendarModalProps {
    isOpen: boolean;
    calendar: CalDAVCalendar;
    onClose: () => void;
    onSaved: () => void;
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

const EditCalendarModal: React.FC<EditCalendarModalProps> = ({
    isOpen,
    calendar,
    onClose,
    onSaved,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [formData, setFormData] = useState({
        name: calendar.name,
        description: calendar.description || '',
        color: calendar.color || DEFAULT_COLORS[0],
        enabled: calendar.enabled,
        sync_direction: calendar.sync_direction,
        sync_interval_minutes: calendar.sync_interval_minutes,
        conflict_resolution: calendar.conflict_resolution,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: calendar.name,
                description: calendar.description || '',
                color: calendar.color || DEFAULT_COLORS[0],
                enabled: calendar.enabled,
                sync_direction: calendar.sync_direction,
                sync_interval_minutes: calendar.sync_interval_minutes,
                conflict_resolution: calendar.conflict_resolution,
            });
            setError('');
        }
    }, [isOpen, calendar]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError(
                t(
                    'profile.caldavWizard.calendarNameRequired',
                    'Calendar name is required'
                )
            );
            return;
        }

        if (
            formData.sync_interval_minutes < 1 ||
            formData.sync_interval_minutes > 1440
        ) {
            setError(
                t(
                    'profile.editCalendar.intervalError',
                    'Sync interval must be between 1 and 1440 minutes'
                )
            );
            return;
        }

        setIsSubmitting(true);

        try {
            await updateCalendar(calendar.id, {
                name: formData.name,
                description: formData.description || null,
                color: formData.color,
                enabled: formData.enabled,
                sync_direction: formData.sync_direction,
                sync_interval_minutes: formData.sync_interval_minutes,
                conflict_resolution: formData.conflict_resolution,
            });

            showSuccessToast(
                t(
                    'profile.editCalendar.updateSuccess',
                    'Calendar updated successfully'
                )
            );
            onSaved();
        } catch (err: any) {
            const errorMessage =
                err.message ||
                t('profile.editCalendar.updateError', 'Failed to update calendar');
            setError(errorMessage);
            showErrorToast(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {t('profile.editCalendar.title', 'Edit Calendar')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('profile.caldavWizard.calendarName', 'Calendar name')}{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            disabled={isSubmitting}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('profile.caldavWizard.description', 'Description')}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            disabled={isSubmitting}
                            rows={3}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
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
                                        setFormData({ ...formData, color })
                                    }
                                    disabled={isSubmitting}
                                    className={`w-10 h-10 rounded-full border-4 transition-all disabled:opacity-50 ${
                                        formData.color === color
                                            ? 'border-gray-400 dark:border-gray-500 scale-110'
                                            : 'border-transparent hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        enabled: e.target.checked,
                                    })
                                }
                                disabled={isSubmitting}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('profile.editCalendar.enableSync', 'Enable synchronization')}
                            </span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('profile.caldavWizard.syncDirection', 'Sync direction')}
                        </label>
                        <select
                            value={formData.sync_direction}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    sync_direction: e.target.value as
                                        | 'bidirectional'
                                        | 'pull'
                                        | 'push',
                                })
                            }
                            disabled={isSubmitting}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                                    'Pull only (from server to Tududi)'
                                )}
                            </option>
                            <option value="push">
                                {t(
                                    'profile.caldavWizard.pushOnly',
                                    'Push only (from Tududi to server)'
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
                            min="1"
                            max="1440"
                            value={formData.sync_interval_minutes}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    sync_interval_minutes: parseInt(e.target.value),
                                })
                            }
                            disabled={isSubmitting}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                            value={formData.conflict_resolution}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    conflict_resolution: e.target.value as
                                        | 'last_write_wins'
                                        | 'local_wins'
                                        | 'remote_wins'
                                        | 'manual',
                                })
                            }
                            disabled={isSubmitting}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {error}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md disabled:opacity-50"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-4 py-2 rounded-md text-white ${
                                isSubmitting
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                        >
                            {isSubmitting
                                ? t('common.saving', 'Saving...')
                                : t('common.save', 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default EditCalendarModal;
