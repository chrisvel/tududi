import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../Shared/ConfirmDialog';
import {
    createBackup,
    listSavedBackups,
    downloadSavedBackup,
    restoreSavedBackup,
    deleteSavedBackup,
    importBackup,
    validateBackup,
    ValidationResult,
    SavedBackup,
} from '../../utils/backupService';
import {
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    DocumentCheckIcon,
    TrashIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface BackupRestoreProps {
    onImportSuccess?: () => void;
}

type TabType = 'export' | 'import';

interface ConfirmDialogState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmButtonText?: string;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ onImportSuccess }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('export');
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);
    const [savedBackups, setSavedBackups] = useState<SavedBackup[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [validationResult, setValidationResult] =
        useState<ValidationResult | null>(null);
    const [appVersion, setAppVersion] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        confirmButtonText: undefined,
    });

    const { showSuccessToast, showErrorToast } = useToast();

    // Load saved backups and app version on mount
    useEffect(() => {
        loadBackups();
        fetchAppVersion();
    }, []);

    const fetchAppVersion = async () => {
        try {
            const response = await fetch('/api/version', {
                credentials: 'include',
            });
            const data = await response.json();
            setAppVersion(data.version);
        } catch (error) {
            console.error('Error fetching app version:', error);
        }
    };

    const loadBackups = async () => {
        setIsLoadingBackups(true);
        try {
            const backups = await listSavedBackups();
            setSavedBackups(backups);
        } catch (error) {
            console.error('Error loading backups:', error);
        } finally {
            setIsLoadingBackups(false);
        }
    };

    const handleCreateBackup = async () => {
        setIsExporting(true);
        try {
            await createBackup();
            showSuccessToast(
                t('backup.exportSuccess', 'Backup created successfully!')
            );
            // Reload the backup list
            await loadBackups();
        } catch (error) {
            console.error('Export error:', error);
            showErrorToast(t('backup.exportError', 'Failed to create backup'));
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadBackup = async (backupUid: string) => {
        try {
            await downloadSavedBackup(backupUid);
            showSuccessToast(
                t('backup.downloadSuccess', 'Backup downloaded successfully!')
            );
        } catch (error) {
            console.error('Download error:', error);
            showErrorToast(
                t('backup.downloadError', 'Failed to download backup')
            );
        }
    };

    const handleRestoreBackup = (backupUid: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('backup.confirmRestore', 'Restore Backup'),
            message: t(
                'backup.confirmRestoreMessage',
                'Are you sure you want to restore this backup? This will merge the backed up data with your current data.'
            ),
            confirmButtonText: t('backup.restoreButton', 'Restore'),
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    const result = await restoreSavedBackup(backupUid, true);
                    showSuccessToast(
                        t('backup.restoreSuccess', {
                            tasks: result.stats.tasks.created,
                            projects: result.stats.projects.created,
                            notes: result.stats.notes.created,
                        })
                    );
                    if (onImportSuccess) {
                        onImportSuccess();
                    }
                } catch (error) {
                    console.error('Restore error:', error);
                    showErrorToast(
                        t('backup.restoreError', 'Failed to restore backup')
                    );
                }
            },
        });
    };

    const handleDeleteBackup = (backupUid: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('backup.confirmDelete', 'Delete Backup'),
            message: t(
                'backup.confirmDeleteMessage',
                'Are you sure you want to delete this backup? This action cannot be undone.'
            ),
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await deleteSavedBackup(backupUid);
                    showSuccessToast(
                        t(
                            'backup.deleteSuccess',
                            'Backup deleted successfully!'
                        )
                    );
                    // Reload the backup list
                    await loadBackups();
                } catch (error) {
                    console.error('Delete error:', error);
                    showErrorToast(
                        t('backup.deleteError', 'Failed to delete backup')
                    );
                }
            },
        });
    };

    const handleFileSelect = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setValidationResult(null);

        // Auto-validate on file selection
        setIsValidating(true);
        try {
            const result = await validateBackup(file);
            setValidationResult(result);
            if (!result.valid) {
                showErrorToast(
                    t(
                        'backup.validationError',
                        'The selected file is not a valid backup'
                    )
                );
            }
        } catch (error) {
            console.error('Validation error:', error);
            showErrorToast(
                t('backup.validationError', 'Failed to validate backup file')
            );
        } finally {
            setIsValidating(false);
        }
    };

    const handleImport = async () => {
        if (!selectedFile || !validationResult?.valid) return;

        setIsImporting(true);
        try {
            const result = await importBackup(selectedFile, true);
            showSuccessToast(
                t('backup.importSuccess', {
                    tasks: result.stats.tasks.created,
                    projects: result.stats.projects.created,
                    notes: result.stats.notes.created,
                })
            );
            // Reset file selection
            setSelectedFile(null);
            setValidationResult(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            if (onImportSuccess) {
                onImportSuccess();
            }
        } catch (error) {
            console.error('Import error:', error);
            showErrorToast(t('backup.importError', 'Failed to import backup'));
        } finally {
            setIsImporting(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <>
            {confirmDialog.isOpen && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() =>
                        setConfirmDialog({ ...confirmDialog, isOpen: false })
                    }
                    confirmButtonText={confirmDialog.confirmButtonText}
                />
            )}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {t('backup.title', 'Backup & Restore')}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'backup.description',
                            'Create backups or restore from previous backups. Your last 5 backups are automatically saved.'
                        )}
                    </p>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('export')}
                                className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'export'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <ArrowDownTrayIcon className="h-5 w-5" />
                                    <span>
                                        {t(
                                            'backup.createBackup',
                                            'Create Backup'
                                        )}
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('import')}
                                className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'import'
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <ArrowUpTrayIcon className="h-5 w-5" />
                                    <span>
                                        {t(
                                            'backup.importFromFile',
                                            'Import from File'
                                        )}
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-8">
                        {activeTab === 'export' ? (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        {t(
                                            'backup.createNewBackup',
                                            'Create New Backup'
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t(
                                            'backup.createDescription',
                                            'Create a new backup of all your data. Backups are saved on the server and you can restore them later.'
                                        )}
                                    </p>
                                </div>

                                <button
                                    onClick={handleCreateBackup}
                                    disabled={isExporting}
                                    className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
                                >
                                    {isExporting ? (
                                        <>
                                            <svg
                                                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                            {t(
                                                'backup.creating',
                                                'Creating backup...'
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                                            {t(
                                                'backup.createBackupNow',
                                                'Create Backup Now'
                                            )}
                                        </>
                                    )}
                                </button>

                                {/* Saved Backups Table */}
                                <div className="mt-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                            {t(
                                                'backup.savedBackups',
                                                'Saved Backups'
                                            )}
                                        </h3>
                                        <button
                                            onClick={loadBackups}
                                            disabled={isLoadingBackups}
                                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
                                        >
                                            <ArrowPathIcon
                                                className={`h-4 w-4 mr-1 ${isLoadingBackups ? 'animate-spin' : ''}`}
                                            />
                                            {t('common.refresh', 'Refresh')}
                                        </button>
                                    </div>

                                    {isLoadingBackups ? (
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                            {t('common.loading', 'Loading...')}
                                        </div>
                                    ) : savedBackups.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                            {t(
                                                'backup.noBackups',
                                                'No backups found. Create your first backup above.'
                                            )}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-700">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            {t(
                                                                'backup.createdAt',
                                                                'Created'
                                                            )}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            {t(
                                                                'backup.version',
                                                                'Version'
                                                            )}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            {t(
                                                                'backup.size',
                                                                'Size'
                                                            )}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            {t(
                                                                'backup.contents',
                                                                'Contents'
                                                            )}
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                            {t(
                                                                'backup.actions',
                                                                'Actions'
                                                            )}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {savedBackups.map(
                                                        (backup) => (
                                                            <tr
                                                                key={backup.uid}
                                                                className="hover:bg-gray-50 dark:hover:bg-gray-700"
                                                            >
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                                    {formatDate(
                                                                        backup.created_at
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                    {
                                                                        backup.version
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                    {formatFileSize(
                                                                        backup.file_size
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                                            {
                                                                                backup
                                                                                    .item_counts
                                                                                    .tasks
                                                                            }{' '}
                                                                            tasks
                                                                        </span>
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                            {
                                                                                backup
                                                                                    .item_counts
                                                                                    .projects
                                                                            }{' '}
                                                                            projects
                                                                        </span>
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                                                            {
                                                                                backup
                                                                                    .item_counts
                                                                                    .notes
                                                                            }{' '}
                                                                            notes
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <div className="flex items-center justify-end space-x-2">
                                                                        <button
                                                                            onClick={() =>
                                                                                handleRestoreBackup(
                                                                                    backup.uid
                                                                                )
                                                                            }
                                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                                            title={t(
                                                                                'backup.restore',
                                                                                'Restore'
                                                                            )}
                                                                        >
                                                                            <ArrowPathIcon className="h-5 w-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                handleDownloadBackup(
                                                                                    backup.uid
                                                                                )
                                                                            }
                                                                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                                            title={t(
                                                                                'backup.download',
                                                                                'Download'
                                                                            )}
                                                                        >
                                                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                handleDeleteBackup(
                                                                                    backup.uid
                                                                                )
                                                                            }
                                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                            title={t(
                                                                                'backup.delete',
                                                                                'Delete'
                                                                            )}
                                                                        >
                                                                            <TrashIcon className="h-5 w-5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        {t(
                                            'backup.importTitle',
                                            'Import from File'
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t(
                                            'backup.importDescription',
                                            'Upload a backup file to restore your data. Your existing data will be preserved, and new items from the backup will be added.'
                                        )}
                                    </p>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                                    <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                                        {t('backup.importNote', 'Important:')}
                                    </h4>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                        {t(
                                            'backup.importNoteDescription',
                                            'Import will merge data with your existing items. Duplicate items (same UID) will be skipped.'
                                        )}
                                    </p>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/json,.json,.gz,.json.gz,application/gzip"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <button
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    className="w-full flex items-center justify-center px-6 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition duration-150 ease-in-out"
                                >
                                    <div className="text-center">
                                        <ArrowUpTrayIcon className="h-12 w-12 mx-auto mb-2" />
                                        <p className="text-base font-medium">
                                            {t(
                                                'backup.selectFile',
                                                'Select Backup File'
                                            )}
                                        </p>
                                        <p className="text-sm mt-1">
                                            {t(
                                                'backup.clickToUpload',
                                                'Click to browse files'
                                            )}
                                        </p>
                                    </div>
                                </button>

                                {selectedFile && (
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <p className="text-base font-medium text-gray-900 dark:text-white">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {(
                                                        selectedFile.size / 1024
                                                    ).toFixed(2)}{' '}
                                                    KB
                                                </p>
                                            </div>
                                            {isValidating && (
                                                <svg
                                                    className="animate-spin h-6 w-6 text-blue-600"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                </svg>
                                            )}
                                            {validationResult?.valid && (
                                                <DocumentCheckIcon className="h-6 w-6 text-green-600" />
                                            )}
                                        </div>

                                        {validationResult?.valid &&
                                            validationResult.summary && (
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                        {t(
                                                            'backup.backupContents',
                                                            'Backup contents:'
                                                        )}
                                                    </p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .tasks
                                                            }{' '}
                                                            tasks
                                                        </div>
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .projects
                                                            }{' '}
                                                            projects
                                                        </div>
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .notes
                                                            }{' '}
                                                            notes
                                                        </div>
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .tags
                                                            }{' '}
                                                            tags
                                                        </div>
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .areas
                                                            }{' '}
                                                            areas
                                                        </div>
                                                        <div className="flex items-center">
                                                            <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                                                            {
                                                                validationResult
                                                                    .summary
                                                                    .views
                                                            }{' '}
                                                            views
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                        {validationResult &&
                                            !validationResult.valid && (
                                                <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                                                    {validationResult.versionIncompatible ? (
                                                        <>
                                                            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                                                {t(
                                                                    'backup.versionIncompatible',
                                                                    'Version Incompatible'
                                                                )}
                                                            </p>
                                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                                {
                                                                    validationResult.message
                                                                }
                                                            </p>
                                                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                                                                {t(
                                                                    'backup.backupVersion',
                                                                    'Backup version'
                                                                )}
                                                                :{' '}
                                                                {
                                                                    validationResult.backupVersion
                                                                }
                                                            </p>
                                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                                {t(
                                                                    'backup.currentVersion',
                                                                    'Current version'
                                                                )}
                                                                : {appVersion}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                                                {t(
                                                                    'backup.validationErrors',
                                                                    'Validation errors:'
                                                                )}
                                                            </p>
                                                            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                                                {validationResult.errors?.map(
                                                                    (
                                                                        error,
                                                                        index
                                                                    ) => (
                                                                        <li
                                                                            key={
                                                                                index
                                                                            }
                                                                        >
                                                                            •{' '}
                                                                            {
                                                                                error
                                                                            }
                                                                        </li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )}

                                {selectedFile && validationResult?.valid && (
                                    <button
                                        onClick={handleImport}
                                        disabled={isImporting}
                                        className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
                                    >
                                        {isImporting ? (
                                            <>
                                                <svg
                                                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                </svg>
                                                {t(
                                                    'backup.importing',
                                                    'Importing...'
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                                                {t(
                                                    'backup.restoreBackup',
                                                    'Restore Backup'
                                                )}
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
        />
    </svg>
);

export default BackupRestore;
