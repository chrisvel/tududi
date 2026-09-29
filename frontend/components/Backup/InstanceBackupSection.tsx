import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ExclamationTriangleIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import {
    downloadInstanceBackup,
    importInstanceBackup,
    InstanceImportResult,
} from '../../utils/backupService';

interface InstanceBackupSectionProps {
    onImportSuccess?: () => void;
}

// Admin-only: back up and restore every account on the instance, so a
// reinstall brings back the other members, their data and shares (#1660).
const InstanceBackupSection: React.FC<InstanceBackupSectionProps> = ({
    onImportSuccess,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [result, setResult] = useState<InstanceImportResult | null>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await downloadInstanceBackup();
        } catch (error) {
            console.error('Instance backup download error:', error);
            showErrorToast(
                t('backup.instance.downloadError', 'Failed to download backup')
            );
        } finally {
            setIsDownloading(false);
        }
    };

    const handleRestore = async (file: File) => {
        setPendingFile(null);
        setIsRestoring(true);
        setResult(null);
        try {
            const restored = await importInstanceBackup(file);
            setResult(restored);
            showSuccessToast(
                t('backup.instance.restoreSuccess', 'All accounts restored')
            );
            onImportSuccess?.();
        } catch (error) {
            showErrorToast(
                error instanceof Error
                    ? error.message
                    : t(
                          'backup.instance.restoreError',
                          'Failed to restore backup'
                      )
            );
        } finally {
            setIsRestoring(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const created = result?.accounts.filter((a) => a.status === 'created');
    const existing = result?.accounts.filter((a) => a.status === 'existing');

    return (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
                <UsersIcon className="h-5 w-5" />
                {t('backup.instance.title', 'All accounts')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t(
                    'backup.instance.description',
                    'Back up every account on this instance with its data, shares and groups, to move it or reinstall. Restoring adds what is missing: existing accounts are never changed, and running it twice adds nothing new.'
                )}
            </p>
            <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                {t(
                    'backup.instance.warning',
                    "The file contains everyone's data and password hashes. Keep it somewhere private."
                )}
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    {isDownloading
                        ? t('backup.instance.downloading', 'Preparing...')
                        : t(
                              'backup.instance.download',
                              'Download backup of all accounts'
                          )}
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRestoring}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                    <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                    {isRestoring
                        ? t('backup.instance.restoring', 'Restoring...')
                        : t(
                              'backup.instance.restore',
                              'Restore backup of all accounts'
                          )}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.gz,application/json,application/gzip"
                    className="hidden"
                    data-testid="instance-backup-file"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingFile(file);
                    }}
                />
            </div>

            {result && (
                <div
                    className="mt-4 rounded-md bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-800 dark:text-green-200"
                    data-testid="instance-backup-result"
                >
                    <p>
                        {t(
                            'backup.instance.resultAccounts',
                            '{{created}} accounts added, {{existing}} already here.',
                            {
                                created: created?.length ?? 0,
                                existing: existing?.length ?? 0,
                            }
                        )}
                    </p>
                    {created && created.length > 0 && (
                        <p className="mt-1">
                            {created
                                .map((a) => a.name || a.email || '?')
                                .join(', ')}
                        </p>
                    )}
                    {result.skipped.length > 0 && (
                        <p className="mt-1">
                            {t(
                                'backup.instance.resultSkipped',
                                '{{count}} shares could not be restored because their account or item is missing.',
                                { count: result.skipped.length }
                            )}
                        </p>
                    )}
                </div>
            )}

            {pendingFile && (
                <ConfirmDialog
                    title={t(
                        'backup.instance.confirmTitle',
                        'Restore all accounts?'
                    )}
                    message={t(
                        'backup.instance.confirmMessage',
                        'Accounts and records from "{{file}}" that are not here yet will be added. Nothing that exists is changed or removed.',
                        { file: pendingFile.name }
                    )}
                    confirmButtonText={t(
                        'backup.instance.confirmButton',
                        'Restore'
                    )}
                    onConfirm={() => void handleRestore(pendingFile)}
                    onCancel={() => {
                        setPendingFile(null);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }}
                />
            )}
        </div>
    );
};

export default InstanceBackupSection;
