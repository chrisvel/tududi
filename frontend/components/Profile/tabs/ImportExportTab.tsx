import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableCellsIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import ImportWizard from '../../Spreadsheet/ImportWizard';
import {
    ImportHistoryItem,
    SpreadsheetFormat,
    downloadImportTemplate,
    exportTasks,
    listImports,
    undoImport,
} from '../../../utils/spreadsheetService';

interface ImportExportTabProps {
    isActive: boolean;
}

const buttonClass =
    'inline-flex items-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600';

const ImportExportTab: React.FC<ImportExportTabProps> = ({ isActive }) => {
    const { t, i18n } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const [wizardOpen, setWizardOpen] = useState(false);
    const [includeCompleted, setIncludeCompleted] = useState(true);
    const [exporting, setExporting] = useState<SpreadsheetFormat | null>(null);
    const [history, setHistory] = useState<ImportHistoryItem[]>([]);
    const [undoing, setUndoing] = useState<string | null>(null);

    const loadHistory = useCallback(() => {
        listImports()
            .then(setHistory)
            .catch(() => setHistory([]));
    }, []);

    useEffect(() => {
        if (isActive) loadHistory();
    }, [isActive, loadHistory]);

    if (!isActive) return null;

    const runExport = async (format: SpreadsheetFormat) => {
        setExporting(format);
        try {
            await exportTasks(format, { include_completed: includeCompleted });
        } catch (e) {
            showErrorToast((e as Error).message);
        } finally {
            setExporting(null);
        }
    };

    const runUndo = async (uid: string) => {
        setUndoing(uid);
        try {
            await undoImport(uid);
            showSuccessToast(
                t('spreadsheet.import.undone', 'The import was undone.')
            );
            loadHistory();
        } catch (e) {
            showErrorToast((e as Error).message);
        } finally {
            setUndoing(null);
        }
    };

    const formatDate = (value: string | null) =>
        value
            ? new Date(value).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              })
            : '';

    return (
        <div className="mb-8">
            <h3 className="mb-6 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <TableCellsIcon className="mr-3 h-6 w-6 text-green-600" />
                {t('spreadsheet.tab.title', 'Import & export')}
            </h3>

            <div className="space-y-8">
                <section className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <h4 className="mb-1 font-semibold text-gray-900 dark:text-white">
                        {t('spreadsheet.tab.importTitle', 'Import tasks')}
                    </h4>
                    <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'spreadsheet.tab.importText',
                            'Bring tasks and projects in from Excel or a CSV file, including files exported from other tools. Columns you do not need can be kept in each task note.'
                        )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setWizardOpen(true)}
                            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            {t(
                                'spreadsheet.tab.importButton',
                                'Import from a spreadsheet'
                            )}
                        </button>
                        <button
                            type="button"
                            className={buttonClass}
                            onClick={() =>
                                downloadImportTemplate('xlsx').catch((e) =>
                                    showErrorToast(e.message)
                                )
                            }
                        >
                            {t(
                                'spreadsheet.tab.template',
                                'Download the template'
                            )}
                        </button>
                    </div>
                </section>

                <section className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <h4 className="mb-1 font-semibold text-gray-900 dark:text-white">
                        {t('spreadsheet.tab.exportTitle', 'Export tasks')}
                    </h4>
                    <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                        {t(
                            'spreadsheet.tab.exportText',
                            'Every task you can see, one row each, with its project, dates, status and tags. Edit the file and import it again to update the same tasks.'
                        )}
                    </p>
                    <label className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                            type="checkbox"
                            checked={includeCompleted}
                            onChange={(e) =>
                                setIncludeCompleted(e.target.checked)
                            }
                        />
                        {t(
                            'spreadsheet.tab.includeCompleted',
                            'Include completed and cancelled tasks'
                        )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={buttonClass}
                            disabled={exporting !== null}
                            onClick={() => runExport('xlsx')}
                        >
                            {t(
                                'spreadsheet.menu.exportExcel',
                                'Export to Excel'
                            )}
                        </button>
                        <button
                            type="button"
                            className={buttonClass}
                            disabled={exporting !== null}
                            onClick={() => runExport('csv')}
                        >
                            {t('spreadsheet.menu.exportCsv', 'Export to CSV')}
                        </button>
                    </div>
                </section>

                {history.length > 0 && (
                    <section>
                        <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                            {t('spreadsheet.tab.recentTitle', 'Recent imports')}
                        </h4>
                        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-gray-50 dark:divide-gray-800 dark:bg-gray-900/40">
                            {history.map((item) => (
                                <li
                                    key={item.uid}
                                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                                            {item.file_name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatDate(item.committed_at)}
                                            {item.counts &&
                                                ` · ${t('spreadsheet.tab.historyCounts', '{{created}} created, {{updated}} updated', item.counts)}`}
                                        </div>
                                    </div>
                                    {item.status === 'undone' ? (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'spreadsheet.tab.undoneLabel',
                                                'Undone'
                                            )}
                                        </span>
                                    ) : (
                                        item.can_undo && (
                                            <button
                                                type="button"
                                                className={buttonClass}
                                                disabled={undoing !== null}
                                                onClick={() =>
                                                    runUndo(item.uid)
                                                }
                                            >
                                                {t(
                                                    'spreadsheet.import.undo',
                                                    'Undo import'
                                                )}
                                            </button>
                                        )
                                    )}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'spreadsheet.tab.undoText',
                                'Undo deletes the tasks an import created, puts updated tasks back as they were, and removes projects it created once they are empty. It is available for 7 days.'
                            )}
                        </p>
                    </section>
                )}
            </div>

            {wizardOpen && (
                <ImportWizard
                    onClose={() => {
                        setWizardOpen(false);
                        loadHistory();
                    }}
                    onImported={loadHistory}
                />
            )}
        </div>
    );
};

export default ImportExportTab;
