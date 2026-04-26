import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    XMarkIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchConflicts,
    resolveConflict,
    type ConflictDetail,
} from '../../utils/caldavService';
import { format } from 'date-fns';

interface ConflictResolverProps {
    isOpen: boolean;
    calendarId: number;
    onClose: () => void;
    onResolved: () => void;
}

interface FieldResolution {
    field: string;
    choice: 'local' | 'remote';
}

const CONFLICT_FIELDS = [
    'name',
    'status',
    'priority',
    'due_date_at',
    'note',
    'completed_at',
];

const ConflictResolver: React.FC<ConflictResolverProps> = ({
    isOpen,
    calendarId,
    onClose,
    onResolved,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [resolutions, setResolutions] = useState<
        Record<number, FieldResolution[]>
    >({});
    const [isLoading, setIsLoading] = useState(false);
    const [isResolving, setIsResolving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadConflicts();
        }
    }, [isOpen, calendarId]);

    const loadConflicts = async () => {
        setIsLoading(true);
        try {
            const data = await fetchConflicts(calendarId);
            setConflicts(data);
            if (data.length > 0) {
                initializeResolutions(data);
            }
        } catch {
            showErrorToast(
                t(
                    'profile.conflictResolver.loadError',
                    'Failed to load conflicts'
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const initializeResolutions = (conflictsList: ConflictDetail[]) => {
        const initialResolutions: Record<number, FieldResolution[]> = {};
        conflictsList.forEach((conflict) => {
            const changedFields = getChangedFields(conflict);
            initialResolutions[conflict.id] = changedFields.map((field) => ({
                field,
                choice: 'remote',
            }));
        });
        setResolutions(initialResolutions);
    };

    const getChangedFields = (conflict: ConflictDetail): string[] => {
        const local = conflict.conflict_local_version;
        const remote = conflict.conflict_remote_version;
        const changed: string[] = [];

        for (const field of CONFLICT_FIELDS) {
            if (
                JSON.stringify(local[field]) !== JSON.stringify(remote[field])
            ) {
                changed.push(field);
            }
        }

        return changed;
    };

    const handleFieldChoice = (
        conflictId: number,
        field: string,
        choice: 'local' | 'remote'
    ) => {
        setResolutions((prev) => ({
            ...prev,
            [conflictId]: prev[conflictId].map((res) =>
                res.field === field ? { ...res, choice } : res
            ),
        }));
    };

    const handleUseAllLocal = () => {
        const conflict = conflicts[currentIndex];
        setResolutions((prev) => ({
            ...prev,
            [conflict.id]: prev[conflict.id].map((res) => ({
                ...res,
                choice: 'local',
            })),
        }));
    };

    const handleUseAllRemote = () => {
        const conflict = conflicts[currentIndex];
        setResolutions((prev) => ({
            ...prev,
            [conflict.id]: prev[conflict.id].map((res) => ({
                ...res,
                choice: 'remote',
            })),
        }));
    };

    const handleResolveAll = async () => {
        for (const conflict of conflicts) {
            const resolution = resolutions[conflict.id];
            const allLocal = resolution.every((r) => r.choice === 'local');
            const allRemote = resolution.every((r) => r.choice === 'remote');

            if (!allLocal && !allRemote) {
                showErrorToast(
                    t(
                        'profile.conflictResolver.mixedResolutionError',
                        'Please choose "Use all local" or "Use all remote" for each conflict. Mixed field selections are not yet supported.'
                    )
                );
                return;
            }
        }

        setIsResolving(true);

        try {
            for (const conflict of conflicts) {
                const resolution = resolutions[conflict.id];
                const choice = resolution.every((r) => r.choice === 'local')
                    ? 'local'
                    : 'remote';

                await resolveConflict(conflict.task_id, calendarId, choice);
            }

            showSuccessToast(
                t(
                    'profile.conflictResolver.resolveSuccess',
                    'All conflicts resolved successfully'
                )
            );
            onResolved();
        } catch {
            showErrorToast(
                t(
                    'profile.conflictResolver.resolveError',
                    'Failed to resolve conflicts'
                )
            );
        } finally {
            setIsResolving(false);
        }
    };

    const formatFieldValue = (field: string, value: any): string => {
        if (value === null || value === undefined) {
            return t('common.none', 'None');
        }

        if (field === 'due_date_at' || field === 'completed_at') {
            try {
                return format(new Date(value), 'PPP');
            } catch {
                return String(value);
            }
        }

        if (field === 'note' && String(value).length > 100) {
            return String(value).substring(0, 100) + '...';
        }

        return String(value);
    };

    const getFieldLabel = (field: string): string => {
        const labels: Record<string, string> = {
            name: t('profile.conflictResolver.fields.name', 'Name'),
            status: t('profile.conflictResolver.fields.status', 'Status'),
            priority: t('profile.conflictResolver.fields.priority', 'Priority'),
            due_date_at: t(
                'profile.conflictResolver.fields.dueDate',
                'Due Date'
            ),
            note: t('profile.conflictResolver.fields.note', 'Note'),
            completed_at: t(
                'profile.conflictResolver.fields.completedAt',
                'Completed'
            ),
        };
        return labels[field] || field;
    };

    if (!isOpen) return null;

    if (isLoading) {
        return createPortal(
            <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                </div>
            </div>,
            document.body
        );
    }

    if (conflicts.length === 0) {
        return createPortal(
            <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t(
                            'profile.conflictResolver.noConflicts',
                            'No conflicts'
                        )}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t(
                            'profile.conflictResolver.noConflictsDescription',
                            'There are no conflicts to resolve for this calendar.'
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                    >
                        {t('common.close', 'Close')}
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    const currentConflict = conflicts[currentIndex];
    const currentResolution = resolutions[currentConflict.id] || [];
    const changedFields = getChangedFields(currentConflict);

    return createPortal(
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {t(
                                'profile.conflictResolver.title',
                                'Resolve Sync Conflicts'
                            )}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t(
                                'profile.conflictResolver.conflictCount',
                                'Conflict {{current}} of {{total}}',
                                {
                                    current: currentIndex + 1,
                                    total: conflicts.length,
                                }
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isResolving}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {currentConflict.conflict_local_version?.name ||
                                t('common.untitled', 'Untitled')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.conflictResolver.detectedAt',
                                'Detected: {{time}}',
                                {
                                    time: format(
                                        new Date(
                                            currentConflict.conflict_detected_at
                                        ),
                                        'PPpp'
                                    ),
                                }
                            )}
                        </p>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {t(
                            'profile.conflictResolver.chooseVersion',
                            'Choose which version to keep for each field:'
                        )}
                    </p>

                    <div className="space-y-4">
                        {changedFields.map((field) => {
                            const resolution = currentResolution.find(
                                (r) => r.field === field
                            );
                            const localValue =
                                currentConflict.conflict_local_version[field];
                            const remoteValue =
                                currentConflict.conflict_remote_version[field];

                            return (
                                <div
                                    key={field}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                >
                                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-medium text-sm text-gray-700 dark:text-gray-300">
                                        {getFieldLabel(field)}
                                    </div>
                                    <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleFieldChoice(
                                                    currentConflict.id,
                                                    field,
                                                    'local'
                                                )
                                            }
                                            className={`p-4 text-left transition-colors ${
                                                resolution?.choice === 'local'
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    {t(
                                                        'profile.conflictResolver.local',
                                                        'Local (TaskNoteTaker)'
                                                    )}
                                                </span>
                                                {resolution?.choice ===
                                                    'local' && (
                                                    <CheckIcon className="w-5 h-5 text-blue-600" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-900 dark:text-white break-words">
                                                {formatFieldValue(
                                                    field,
                                                    localValue
                                                )}
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleFieldChoice(
                                                    currentConflict.id,
                                                    field,
                                                    'remote'
                                                )
                                            }
                                            className={`p-4 text-left transition-colors ${
                                                resolution?.choice === 'remote'
                                                    ? 'bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-500'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    {t(
                                                        'profile.conflictResolver.remote',
                                                        'Remote (CalDAV)'
                                                    )}
                                                </span>
                                                {resolution?.choice ===
                                                    'remote' && (
                                                    <CheckIcon className="w-5 h-5 text-amber-600" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-900 dark:text-white break-words">
                                                {formatFieldValue(
                                                    field,
                                                    remoteValue
                                                )}
                                            </p>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button
                            type="button"
                            onClick={handleUseAllLocal}
                            className="flex-1 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                        >
                            {t(
                                'profile.conflictResolver.useAllLocal',
                                'Use all local'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleUseAllRemote}
                            className="flex-1 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-sm font-medium"
                        >
                            {t(
                                'profile.conflictResolver.useAllRemote',
                                'Use all remote'
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentIndex((prev) => Math.max(prev - 1, 0))
                            }
                            disabled={currentIndex === 0 || isResolving}
                            className={`inline-flex items-center px-4 py-2 rounded-md ${
                                currentIndex === 0 || isResolving
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                            <ChevronLeftIcon className="w-5 h-5 mr-1" />
                            {t(
                                'profile.conflictResolver.prevConflict',
                                'Previous'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setCurrentIndex((prev) =>
                                    Math.min(prev + 1, conflicts.length - 1)
                                )
                            }
                            disabled={
                                currentIndex === conflicts.length - 1 ||
                                isResolving
                            }
                            className={`inline-flex items-center px-4 py-2 rounded-md ${
                                currentIndex === conflicts.length - 1 ||
                                isResolving
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                            {t(
                                'profile.conflictResolver.nextConflict',
                                'Next'
                            )}
                            <ChevronRightIcon className="w-5 h-5 ml-1" />
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isResolving}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleResolveAll}
                            disabled={isResolving}
                            className={`px-4 py-2 rounded-md text-white ${
                                isResolving
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                            {isResolving
                                ? t('common.resolving', 'Resolving...')
                                : t(
                                      'profile.conflictResolver.applyResolutions',
                                      'Apply Resolutions'
                                  )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConflictResolver;
