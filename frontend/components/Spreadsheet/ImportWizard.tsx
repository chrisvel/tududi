import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    ArrowUpTrayIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { fetchProjects } from '../../utils/projectsService';
import {
    ColumnTarget,
    DateOrder,
    HierarchyMode,
    IMPORT_FIELDS,
    ImportCommitResult,
    ImportField,
    ImportJob,
    ImportOptions,
    ImportPreview,
    PreviewRow,
    RowIssue,
    SheetColumns,
    TargetMode,
    commitImport,
    discardImport,
    downloadImportTemplate,
    loadImportColumns,
    previewImport,
    undoImport,
    uploadImportFile,
} from '../../utils/spreadsheetService';

interface ImportWizardProps {
    onClose: () => void;
    // Opened from a project: tasks go there unless the user picks otherwise.
    projectUid?: string;
    onImported?: (result: ImportCommitResult) => void;
}

type Step = 'file' | 'columns' | 'review' | 'done';

const FIELD_LABELS: Record<ImportField, [string, string]> = {
    uid: ['spreadsheet.columns.uid', 'UID'],
    name: ['spreadsheet.columns.name', 'Name'],
    project: ['spreadsheet.columns.project', 'Project'],
    area: ['spreadsheet.columns.area', 'Area'],
    parent: ['spreadsheet.import.fieldParent', 'Parent task'],
    wbs: ['spreadsheet.import.fieldWbs', 'WBS / outline number'],
    status: ['spreadsheet.columns.status', 'Status'],
    priority: ['spreadsheet.columns.priority', 'Priority'],
    start: ['spreadsheet.columns.start', 'Start'],
    due: ['spreadsheet.columns.due', 'Due'],
    defer_until: ['spreadsheet.columns.deferUntil', 'Defer until'],
    estimate: ['spreadsheet.import.fieldEstimate', 'Estimate'],
    assignee: ['spreadsheet.columns.assignee', 'Assignee'],
    tags: ['spreadsheet.columns.tags', 'Tags'],
    note: ['spreadsheet.columns.note', 'Note'],
    completed_at: ['spreadsheet.columns.completedAt', 'Completed at'],
};

const STATUS_OPTIONS: [number, string, string][] = [
    [0, 'status.notStarted', 'Not started'],
    [6, 'task.status.planned', 'Planned'],
    [1, 'status.inProgress', 'In progress'],
    [4, 'status.waiting', 'Waiting'],
    [2, 'status.done', 'Done'],
    [5, 'task.status.cancelled', 'Cancelled'],
    [3, 'status.archived', 'Archived'],
];

const PRIORITY_OPTIONS: [number, string, string][] = [
    [0, 'priority.low', 'Low'],
    [1, 'priority.medium', 'Medium'],
    [2, 'priority.high', 'High'],
];

const inputClass =
    'w-full rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100';
const primaryButton =
    'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600';
const secondaryButton =
    'inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600';

const defaultDateOrder = (): 'dmy' | 'mdy' =>
    /^en-US$/i.test(navigator.language) ? 'mdy' : 'dmy';

const ImportWizard: React.FC<ImportWizardProps> = ({
    onClose,
    projectUid,
    onImported,
}) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('file');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<ImportJob | null>(null);
    const [columns, setColumns] = useState<SheetColumns | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [options, setOptions] = useState<ImportOptions | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [onlyIssues, setOnlyIssues] = useState(false);
    const [result, setResult] = useState<ImportCommitResult | null>(null);
    const [undone, setUndone] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        fetchProjects()
            .then((list) =>
                setProjects(
                    [...list].sort((a, b) => a.name.localeCompare(b.name))
                )
            )
            .catch(() => setProjects([]));
    }, []);

    // An upload nobody committed is dropped on close rather than left for
    // the daily clean-up.
    const close = useCallback(() => {
        if (job && step !== 'done') {
            discardImport(job.uid).catch(() => undefined);
        }
        onClose();
    }, [job, step, onClose]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) close();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [close, busy]);

    const startOptions = (
        sheetColumns: SheetColumns,
        sheet: number
    ): ImportOptions => {
        const mapping = sheetColumns.suggested_mapping;
        let mode: TargetMode = 'none';
        if (projectUid) mode = 'project';
        else if (mapping.includes('project')) mode = 'column';
        return {
            sheet,
            header_row: sheetColumns.header_row,
            mapping,
            target: {
                mode,
                project_uid: projectUid || null,
                project_name: '',
            },
            hierarchy: 'auto',
            date_order: 'auto',
            date_order_fallback: defaultDateOrder(),
            value_map: { status: {}, priority: {}, assignee: {} },
            update_existing: true,
            clear_blanks: false,
        };
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            const uploaded = await uploadImportFile(file);
            setJob(uploaded);
            const first = uploaded.sheets[0];
            setColumns(first);
            setOptions(startOptions(first, 0));
            setStep('columns');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const reloadColumns = async (sheet: number, headerRow: number | null) => {
        if (!job) return;
        setBusy(true);
        setError(null);
        try {
            const next = await loadImportColumns(job.uid, sheet, headerRow);
            setColumns(next);
            setOptions((prev) => ({
                ...startOptions(next, sheet),
                target: prev?.target || startOptions(next, sheet).target,
            }));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const runPreview = async (next: ImportOptions) => {
        if (!job) return;
        setBusy(true);
        setError(null);
        try {
            setOptions(next);
            setPreview(await previewImport(job.uid, next));
            setStep('review');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const runImport = async () => {
        if (!job || !options) return;
        setBusy(true);
        setError(null);
        try {
            const done = await commitImport(job.uid, options);
            setResult(done);
            setStep('done');
            onImported?.(done);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const runUndo = async () => {
        if (!result) return;
        setBusy(true);
        setError(null);
        try {
            await undoImport(result.uid);
            setUndone(true);
            onImported?.(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const setTarget = (column: number, target: ColumnTarget) => {
        if (!options) return;
        const mapping = options.mapping.map((current, i) => {
            if (i === column) return target;
            // One column per field: the old holder lets go.
            if (
                current === target &&
                target !== 'ignore' &&
                target !== 'note_append'
            ) {
                return 'ignore';
            }
            return current;
        });
        const targetMode =
            options.target.mode === 'column' && !mapping.includes('project')
                ? projectUid
                    ? 'project'
                    : 'none'
                : options.target.mode;
        setOptions({
            ...options,
            mapping,
            target: { ...options.target, mode: targetMode },
        });
    };

    const issueText = (issue: RowIssue) =>
        t(`spreadsheet.issues.${issue.code}`, {
            defaultValue: issue.code,
            value: issue.value,
            field: issue.field
                ? t(
                      FIELD_LABELS[issue.field as ImportField]?.[0] || '',
                      FIELD_LABELS[issue.field as ImportField]?.[1] ||
                          issue.field
                  )
                : '',
        });

    const sampleFor = (column: number) =>
        (columns?.sample || [])
            .map((row) => row[column])
            .filter(Boolean)
            .slice(0, 2)
            .join(' · ');

    const canPickColumnMode = options?.mapping.includes('project');
    const hasUid = options?.mapping.includes('uid');
    const targetReady =
        options &&
        (options.target.mode !== 'project' || !!options.target.project_uid) &&
        (options.target.mode !== 'new_project' ||
            !!options.target.project_name?.trim());
    const nameMapped =
        options?.mapping.includes('name') || options?.mapping.includes('uid');

    const visibleRows = useMemo(
        () =>
            (preview?.rows || []).filter(
                (row) => !onlyIssues || row.errors.length || row.warnings.length
            ),
        [preview, onlyIssues]
    );

    const ambiguousDates = Object.values(preview?.date_columns || {}).some(
        (c) => c.ambiguous
    );
    const unknown = preview?.unknown_values;
    const hasUnknown =
        !!unknown &&
        (unknown.status.length > 0 ||
            unknown.priority.length > 0 ||
            unknown.assignee.length > 0);

    const setValueMap = (
        kind: 'status' | 'priority' | 'assignee',
        raw: string,
        value: string
    ) => {
        if (!options) return;
        const next: ImportOptions = {
            ...options,
            value_map: {
                ...options.value_map,
                [kind]: {
                    ...options.value_map[kind],
                    [raw]:
                        kind === 'assignee' || value === ''
                            ? value
                            : Number(value),
                },
            },
        };
        runPreview(next);
    };

    const actionBadge = (row: PreviewRow) => {
        const styles = {
            create: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            update: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            skip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        };
        const labels = {
            create: t('spreadsheet.import.actionCreate', 'New'),
            update: t('spreadsheet.import.actionUpdate', 'Update'),
            skip: t('spreadsheet.import.actionSkip', 'Skipped'),
        };
        return (
            <span
                className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${styles[row.action]}`}
            >
                {labels[row.action]}
            </span>
        );
    };

    const steps: [Step, string][] = [
        ['file', t('spreadsheet.import.stepFile', 'File')],
        ['columns', t('spreadsheet.import.stepColumns', 'Columns')],
        ['review', t('spreadsheet.import.stepReview', 'Review')],
    ];
    const stepIndex = steps.findIndex(([s]) => s === step);

    const body = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
            onClick={() => !busy && close()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="spreadsheet-import-title"
                className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 bg-gray-50 px-5 py-4 dark:bg-gray-900/40">
                    <div className="min-w-0">
                        <h2
                            id="spreadsheet-import-title"
                            className="text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            {t(
                                'spreadsheet.import.title',
                                'Import from a spreadsheet'
                            )}
                        </h2>
                        {step !== 'done' && (
                            <ol className="mt-1 flex flex-wrap gap-3 text-xs">
                                {steps.map(([key, label], i) => (
                                    <li
                                        key={key}
                                        className={
                                            i === stepIndex
                                                ? 'font-semibold text-blue-600 dark:text-blue-400'
                                                : i < stepIndex
                                                  ? 'text-gray-700 dark:text-gray-300'
                                                  : 'text-gray-400'
                                        }
                                    >
                                        {i + 1}. {label}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        disabled={busy}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label={t('common.close', 'Close')}
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'file' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {t(
                                    'spreadsheet.import.intro',
                                    "Bring tasks in from Excel or a CSV file. You'll match up the columns and see every row before anything is saved."
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    handleFile(e.dataTransfer.files?.[0]);
                                }}
                                disabled={busy}
                                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl px-6 py-12 text-center transition-colors ${
                                    dragging
                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-900/60'
                                }`}
                            >
                                <ArrowUpTrayIcon className="h-8 w-8 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {busy
                                        ? t(
                                              'spreadsheet.import.reading',
                                              'Reading the file…'
                                          )
                                        : t(
                                              'spreadsheet.import.chooseFile',
                                              'Choose a file or drop it here'
                                          )}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t(
                                        'spreadsheet.import.fileTypes',
                                        '.xlsx or .csv, up to 5 MB and 5,000 rows'
                                    )}
                                </span>
                            </button>
                            <input
                                ref={fileInput}
                                type="file"
                                accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="hidden"
                                onChange={(e) => {
                                    handleFile(e.target.files?.[0]);
                                    e.target.value = '';
                                }}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'spreadsheet.import.templateHint',
                                    'Starting from scratch? Use the template:'
                                )}{' '}
                                <button
                                    type="button"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    onClick={() =>
                                        downloadImportTemplate('xlsx').catch(
                                            (e) => setError(e.message)
                                        )
                                    }
                                >
                                    Excel
                                </button>
                                {' · '}
                                <button
                                    type="button"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    onClick={() =>
                                        downloadImportTemplate('csv').catch(
                                            (e) => setError(e.message)
                                        )
                                    }
                                >
                                    CSV
                                </button>
                            </p>
                        </div>
                    )}

                    {step === 'columns' && job && columns && options && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-end gap-4">
                                {job.sheets.length > 1 && (
                                    <label className="text-sm">
                                        <span className="mb-1 block text-gray-600 dark:text-gray-300">
                                            {t(
                                                'spreadsheet.import.sheet',
                                                'Sheet'
                                            )}
                                        </span>
                                        <select
                                            className={inputClass}
                                            value={options.sheet}
                                            onChange={(e) =>
                                                reloadColumns(
                                                    Number(e.target.value),
                                                    null
                                                )
                                            }
                                        >
                                            {job.sheets.map((sheet, i) => (
                                                <option key={i} value={i}>
                                                    {sheet.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                <label className="text-sm">
                                    <span className="mb-1 block text-gray-600 dark:text-gray-300">
                                        {t(
                                            'spreadsheet.import.headerRow',
                                            'Column names are in row'
                                        )}
                                    </span>
                                    <select
                                        className={inputClass}
                                        value={columns.header_row}
                                        onChange={(e) =>
                                            reloadColumns(
                                                options.sheet,
                                                Number(e.target.value)
                                            )
                                        }
                                    >
                                        {Array.from({ length: 10 }, (_, i) => (
                                            <option key={i} value={i}>
                                                {i + 1}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <p className="pb-2 text-sm text-gray-500 dark:text-gray-400">
                                    {t(
                                        'spreadsheet.import.rowCount',
                                        '{{count}} rows',
                                        { count: columns.row_count }
                                    )}
                                    {job.sheets[options.sheet]?.truncated &&
                                        ` · ${t('spreadsheet.import.truncated', 'only the first 5,000 rows and 60 columns are read')}`}
                                </p>
                            </div>

                            <section>
                                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    {t(
                                        'spreadsheet.import.matchColumns',
                                        'Match the columns'
                                    )}
                                </h3>
                                <div className="overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900/40">
                                    {columns.headers.map((header, i) => (
                                        <div
                                            key={i}
                                            className="grid grid-cols-1 gap-2 px-3 py-2 odd:bg-white/60 sm:grid-cols-[1fr_1fr_14rem] sm:items-center dark:odd:bg-gray-800/40"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {header ||
                                                        t(
                                                            'spreadsheet.import.unnamedColumn',
                                                            'Column {{number}}',
                                                            { number: i + 1 }
                                                        )}
                                                </div>
                                            </div>
                                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                {sampleFor(i) || '—'}
                                            </div>
                                            <select
                                                className={inputClass}
                                                value={options.mapping[i]}
                                                aria-label={header}
                                                onChange={(e) =>
                                                    setTarget(
                                                        i,
                                                        e.target
                                                            .value as ColumnTarget
                                                    )
                                                }
                                            >
                                                {IMPORT_FIELDS.map((field) => (
                                                    <option
                                                        key={field}
                                                        value={field}
                                                    >
                                                        {t(
                                                            FIELD_LABELS[
                                                                field
                                                            ][0],
                                                            FIELD_LABELS[
                                                                field
                                                            ][1]
                                                        )}
                                                    </option>
                                                ))}
                                                <option value="note_append">
                                                    {t(
                                                        'spreadsheet.import.keepInNote',
                                                        'Keep in the note'
                                                    )}
                                                </option>
                                                <option value="ignore">
                                                    {t(
                                                        'spreadsheet.import.dontImport',
                                                        "Don't import"
                                                    )}
                                                </option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                {!nameMapped && (
                                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                                        {t(
                                            'spreadsheet.issues.name_column_required',
                                            'Pick the column that holds the task names.'
                                        )}
                                    </p>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    {t(
                                        'spreadsheet.import.whereTitle',
                                        'Where should the tasks go?'
                                    )}
                                </h3>
                                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                                    <label className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="radio"
                                            checked={
                                                options.target.mode ===
                                                'project'
                                            }
                                            onChange={() =>
                                                setOptions({
                                                    ...options,
                                                    target: {
                                                        ...options.target,
                                                        mode: 'project',
                                                    },
                                                })
                                            }
                                        />
                                        <span>
                                            {t(
                                                'spreadsheet.import.intoProject',
                                                'Into a project'
                                            )}
                                        </span>
                                        {options.target.mode === 'project' && (
                                            <select
                                                className={`${inputClass} sm:w-72`}
                                                value={
                                                    options.target
                                                        .project_uid || ''
                                                }
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        target: {
                                                            ...options.target,
                                                            project_uid:
                                                                e.target
                                                                    .value ||
                                                                null,
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="">
                                                    {t(
                                                        'spreadsheet.import.pickProject',
                                                        'Pick a project'
                                                    )}
                                                </option>
                                                {projects.map((project) => (
                                                    <option
                                                        key={project.uid}
                                                        value={project.uid}
                                                    >
                                                        {project.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </label>
                                    <label className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="radio"
                                            checked={
                                                options.target.mode ===
                                                'new_project'
                                            }
                                            onChange={() =>
                                                setOptions({
                                                    ...options,
                                                    target: {
                                                        ...options.target,
                                                        mode: 'new_project',
                                                        project_name:
                                                            options.target
                                                                .project_name ||
                                                            job.file_name.replace(
                                                                /\.[^.]+$/,
                                                                ''
                                                            ),
                                                    },
                                                })
                                            }
                                        />
                                        <span>
                                            {t(
                                                'spreadsheet.import.intoNewProject',
                                                'Into a new project'
                                            )}
                                        </span>
                                        {options.target.mode ===
                                            'new_project' && (
                                            <input
                                                className={`${inputClass} sm:w-72`}
                                                value={
                                                    options.target
                                                        .project_name || ''
                                                }
                                                maxLength={150}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        target: {
                                                            ...options.target,
                                                            project_name:
                                                                e.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        )}
                                    </label>
                                    <label
                                        className={`flex items-start gap-2 ${canPickColumnMode ? '' : 'opacity-50'}`}
                                    >
                                        <input
                                            type="radio"
                                            className="mt-1"
                                            disabled={!canPickColumnMode}
                                            checked={
                                                options.target.mode === 'column'
                                            }
                                            onChange={() =>
                                                setOptions({
                                                    ...options,
                                                    target: {
                                                        ...options.target,
                                                        mode: 'column',
                                                    },
                                                })
                                            }
                                        />
                                        <span>
                                            {t(
                                                'spreadsheet.import.byColumn',
                                                'Use the Project column, creating projects that do not exist yet'
                                            )}
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            checked={
                                                options.target.mode === 'none'
                                            }
                                            onChange={() =>
                                                setOptions({
                                                    ...options,
                                                    target: {
                                                        ...options.target,
                                                        mode: 'none',
                                                    },
                                                })
                                            }
                                        />
                                        <span>
                                            {t(
                                                'spreadsheet.import.noProject',
                                                'Not in a project'
                                            )}
                                        </span>
                                    </label>
                                </div>
                                {hasUid && (
                                    <label className="mt-4 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            className="mt-1"
                                            checked={options.update_existing}
                                            onChange={(e) =>
                                                setOptions({
                                                    ...options,
                                                    update_existing:
                                                        e.target.checked,
                                                })
                                            }
                                        />
                                        <span>
                                            {t(
                                                'spreadsheet.import.updateExisting',
                                                'Update tasks that are already in tududi (matched by UID). Empty cells leave a field as it is.'
                                            )}
                                        </span>
                                    </label>
                                )}
                            </section>
                        </div>
                    )}

                    {step === 'review' && preview && options && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="rounded-lg bg-green-50 px-3 py-1.5 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                    {t(
                                        'spreadsheet.import.countCreate',
                                        '{{count}} new tasks',
                                        { count: preview.counts.create }
                                    )}
                                </span>
                                {preview.counts.update > 0 && (
                                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                        {t(
                                            'spreadsheet.import.countUpdate',
                                            '{{count}} updated',
                                            { count: preview.counts.update }
                                        )}
                                    </span>
                                )}
                                {preview.counts.skip > 0 && (
                                    <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                                        {t(
                                            'spreadsheet.import.countSkip',
                                            '{{count}} skipped',
                                            { count: preview.counts.skip }
                                        )}
                                    </span>
                                )}
                                {preview.counts.new_projects > 0 && (
                                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {t(
                                            'spreadsheet.import.countProjects',
                                            '{{count}} new projects',
                                            {
                                                count: preview.counts
                                                    .new_projects,
                                            }
                                        )}
                                    </span>
                                )}
                                {preview.counts.new_areas > 0 && (
                                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {t(
                                            'spreadsheet.import.countAreas',
                                            '{{count}} new areas',
                                            { count: preview.counts.new_areas }
                                        )}
                                    </span>
                                )}
                                {preview.counts.new_tags > 0 && (
                                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {t(
                                            'spreadsheet.import.countTags',
                                            '{{count}} new tags',
                                            { count: preview.counts.new_tags }
                                        )}
                                    </span>
                                )}
                            </div>

                            {preview.new_projects.length > 0 && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {t(
                                        'spreadsheet.import.newProjectsList',
                                        'New projects: {{names}}',
                                        {
                                            names: preview.new_projects.join(
                                                ', '
                                            ),
                                        }
                                    )}
                                </p>
                            )}

                            {preview.problems.length > 0 && (
                                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                    {preview.problems.map((p) => (
                                        <div key={p.code}>{issueText(p)}</div>
                                    ))}
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-sm">
                                    <span className="mb-1 block text-gray-600 dark:text-gray-300">
                                        {t(
                                            'spreadsheet.import.subtasksFrom',
                                            'Subtasks come from'
                                        )}
                                    </span>
                                    <select
                                        className={inputClass}
                                        value={options.hierarchy}
                                        onChange={(e) =>
                                            runPreview({
                                                ...options,
                                                hierarchy: e.target
                                                    .value as HierarchyMode,
                                            })
                                        }
                                    >
                                        <option value="auto">
                                            {t(
                                                'spreadsheet.import.hierarchyAuto',
                                                'Detect it ({{found}})',
                                                {
                                                    found: t(
                                                        `spreadsheet.import.hierarchy_${preview.hierarchy_used}`,
                                                        preview.hierarchy_used
                                                    ),
                                                }
                                            )}
                                        </option>
                                        {(
                                            [
                                                'parent',
                                                'wbs',
                                                'indent',
                                                'flat',
                                            ] as HierarchyMode[]
                                        ).map((mode) => (
                                            <option key={mode} value={mode}>
                                                {t(
                                                    `spreadsheet.import.hierarchy_${mode}`,
                                                    mode
                                                )}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {(ambiguousDates ||
                                    options.date_order !== 'auto') && (
                                    <label className="text-sm">
                                        <span className="mb-1 block text-gray-600 dark:text-gray-300">
                                            {t(
                                                'spreadsheet.import.dateOrder',
                                                'A date like 03/04/2026 means'
                                            )}
                                        </span>
                                        <select
                                            className={inputClass}
                                            value={
                                                options.date_order === 'auto'
                                                    ? options.date_order_fallback
                                                    : options.date_order
                                            }
                                            onChange={(e) =>
                                                runPreview({
                                                    ...options,
                                                    date_order: e.target
                                                        .value as DateOrder,
                                                })
                                            }
                                        >
                                            <option value="dmy">
                                                {t(
                                                    'spreadsheet.import.dateOrderDmy',
                                                    '3 April (day first)'
                                                )}
                                            </option>
                                            <option value="mdy">
                                                {t(
                                                    'spreadsheet.import.dateOrderMdy',
                                                    'March 4 (month first)'
                                                )}
                                            </option>
                                        </select>
                                    </label>
                                )}
                            </div>

                            {hasUnknown && unknown && (
                                <section className="rounded-lg bg-amber-50 px-3 py-3 dark:bg-amber-900/20">
                                    <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                                        {t(
                                            'spreadsheet.import.unknownTitle',
                                            'Words we did not recognise'
                                        )}
                                    </h3>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {unknown.status.map((raw) => (
                                            <label
                                                key={`s-${raw}`}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="truncate text-gray-800 dark:text-gray-200">
                                                    {t(
                                                        'spreadsheet.columns.status',
                                                        'Status'
                                                    )}
                                                    : “{raw}”
                                                </span>
                                                <select
                                                    className={`${inputClass} w-40`}
                                                    value={String(
                                                        options.value_map
                                                            .status[raw] ?? ''
                                                    )}
                                                    onChange={(e) =>
                                                        setValueMap(
                                                            'status',
                                                            raw,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        {t(
                                                            'spreadsheet.import.leaveBlank',
                                                            'Leave as is'
                                                        )}
                                                    </option>
                                                    {STATUS_OPTIONS.map(
                                                        ([
                                                            value,
                                                            key,
                                                            label,
                                                        ]) => (
                                                            <option
                                                                key={value}
                                                                value={value}
                                                            >
                                                                {t(key, label)}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        ))}
                                        {unknown.priority.map((raw) => (
                                            <label
                                                key={`p-${raw}`}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="truncate text-gray-800 dark:text-gray-200">
                                                    {t(
                                                        'spreadsheet.columns.priority',
                                                        'Priority'
                                                    )}
                                                    : “{raw}”
                                                </span>
                                                <select
                                                    className={`${inputClass} w-40`}
                                                    value={String(
                                                        options.value_map
                                                            .priority[raw] ?? ''
                                                    )}
                                                    onChange={(e) =>
                                                        setValueMap(
                                                            'priority',
                                                            raw,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        {t(
                                                            'spreadsheet.import.leaveBlank',
                                                            'Leave as is'
                                                        )}
                                                    </option>
                                                    {PRIORITY_OPTIONS.map(
                                                        ([
                                                            value,
                                                            key,
                                                            label,
                                                        ]) => (
                                                            <option
                                                                key={value}
                                                                value={value}
                                                            >
                                                                {t(key, label)}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        ))}
                                        {unknown.assignee.map((raw) => (
                                            <label
                                                key={`a-${raw}`}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="truncate text-gray-800 dark:text-gray-200">
                                                    {t(
                                                        'spreadsheet.columns.assignee',
                                                        'Assignee'
                                                    )}
                                                    : “{raw}”
                                                </span>
                                                <select
                                                    className={`${inputClass} w-40`}
                                                    value={
                                                        options.value_map
                                                            .assignee[raw] ?? ''
                                                    }
                                                    onChange={(e) =>
                                                        setValueMap(
                                                            'assignee',
                                                            raw,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        {t(
                                                            'spreadsheet.import.nobody',
                                                            'Nobody'
                                                        )}
                                                    </option>
                                                    {preview.assignable.map(
                                                        (person) => (
                                                            <option
                                                                key={person.uid}
                                                                value={
                                                                    person.uid
                                                                }
                                                            >
                                                                {person.name}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {t(
                                            'spreadsheet.import.rowsTitle',
                                            'Rows'
                                        )}
                                    </h3>
                                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={onlyIssues}
                                            onChange={(e) =>
                                                setOnlyIssues(e.target.checked)
                                            }
                                        />
                                        {t(
                                            'spreadsheet.import.onlyIssues',
                                            'Only rows with notes'
                                        )}
                                    </label>
                                </div>
                                <div className="max-h-80 overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900/40">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 bg-gray-100 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    #
                                                </th>
                                                <th className="px-3 py-2 font-medium" />
                                                <th className="px-3 py-2 font-medium">
                                                    {t(
                                                        'spreadsheet.columns.name',
                                                        'Name'
                                                    )}
                                                </th>
                                                <th className="hidden px-3 py-2 font-medium sm:table-cell">
                                                    {t(
                                                        'spreadsheet.columns.project',
                                                        'Project'
                                                    )}
                                                </th>
                                                <th className="hidden px-3 py-2 font-medium sm:table-cell">
                                                    {t(
                                                        'spreadsheet.columns.due',
                                                        'Due'
                                                    )}
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    {t(
                                                        'spreadsheet.import.notes',
                                                        'Notes'
                                                    )}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleRows.map((row) => (
                                                <tr
                                                    key={row.row_number}
                                                    className="align-top odd:bg-white/60 dark:odd:bg-gray-800/40"
                                                >
                                                    <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">
                                                        {row.row_number}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {actionBadge(row)}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                                                        {row.parent && (
                                                            <div className="text-xs text-gray-400">
                                                                ↳ {row.parent}
                                                            </div>
                                                        )}
                                                        {row.name || '—'}
                                                    </td>
                                                    <td className="hidden px-3 py-2 text-gray-600 sm:table-cell dark:text-gray-300">
                                                        {row.project ?? ''}
                                                        {row.project_is_new && (
                                                            <span className="ml-1 text-xs text-green-700 dark:text-green-300">
                                                                {t(
                                                                    'spreadsheet.import.newLabel',
                                                                    'new'
                                                                )}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="hidden whitespace-nowrap px-3 py-2 text-gray-600 sm:table-cell dark:text-gray-300">
                                                        {row.due || ''}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs">
                                                        {row.errors.map(
                                                            (issue, i) => (
                                                                <div
                                                                    key={`e${i}`}
                                                                    className="text-red-600 dark:text-red-400"
                                                                >
                                                                    {issueText(
                                                                        issue
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                        {row.warnings.map(
                                                            (issue, i) => (
                                                                <div
                                                                    key={`w${i}`}
                                                                    className="text-amber-700 dark:text-amber-300"
                                                                >
                                                                    {issueText(
                                                                        issue
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {preview.total_rows > preview.rows.length && (
                                    <p className="mt-2 text-xs text-gray-500">
                                        {t(
                                            'spreadsheet.import.moreRows',
                                            'Showing {{shown}} of {{total}} rows.',
                                            {
                                                shown: preview.rows.length,
                                                total: preview.total_rows,
                                            }
                                        )}
                                    </p>
                                )}
                            </section>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <CheckCircleIcon className="h-12 w-12 text-green-500" />
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {undone
                                    ? t(
                                          'spreadsheet.import.undone',
                                          'The import was undone.'
                                      )
                                    : t(
                                          'spreadsheet.import.doneTitle',
                                          'Imported {{count}} tasks',
                                          { count: result.counts.created }
                                      )}
                            </p>
                            {!undone && (
                                <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
                                    {[
                                        result.counts.updated > 0 &&
                                            t(
                                                'spreadsheet.import.countUpdate',
                                                '{{count}} updated',
                                                {
                                                    count: result.counts
                                                        .updated,
                                                }
                                            ),
                                        result.counts.skipped > 0 &&
                                            t(
                                                'spreadsheet.import.countSkip',
                                                '{{count}} skipped',
                                                {
                                                    count: result.counts
                                                        .skipped,
                                                }
                                            ),
                                        result.counts.new_projects > 0 &&
                                            t(
                                                'spreadsheet.import.countProjects',
                                                '{{count}} new projects',
                                                {
                                                    count: result.counts
                                                        .new_projects,
                                                }
                                            ),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    {result.counts.updated +
                                        result.counts.skipped +
                                        result.counts.new_projects >
                                        0 && <br />}
                                    {t(
                                        'spreadsheet.import.undoHint',
                                        'Changed your mind? You can undo this import for 7 days from Profile → Import & export.'
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-5 py-3 dark:bg-gray-900/40">
                    <div>
                        {step === 'columns' && (
                            <button
                                type="button"
                                className={secondaryButton}
                                disabled={busy}
                                onClick={() => {
                                    if (job) {
                                        discardImport(job.uid).catch(
                                            () => undefined
                                        );
                                    }
                                    setJob(null);
                                    setStep('file');
                                }}
                            >
                                {t(
                                    'spreadsheet.import.otherFile',
                                    'Choose another file'
                                )}
                            </button>
                        )}
                        {step === 'review' && (
                            <button
                                type="button"
                                className={secondaryButton}
                                disabled={busy}
                                onClick={() => setStep('columns')}
                            >
                                {t('common.back', 'Back')}
                            </button>
                        )}
                        {step === 'done' && !undone && (
                            <button
                                type="button"
                                className={secondaryButton}
                                disabled={busy}
                                onClick={runUndo}
                            >
                                {t('spreadsheet.import.undo', 'Undo import')}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {step === 'columns' && options && (
                            <button
                                type="button"
                                className={primaryButton}
                                disabled={busy || !targetReady || !nameMapped}
                                onClick={() => runPreview(options)}
                            >
                                {busy
                                    ? t(
                                          'spreadsheet.import.checking',
                                          'Checking…'
                                      )
                                    : t(
                                          'spreadsheet.import.checkRows',
                                          'Check the rows'
                                      )}
                            </button>
                        )}
                        {step === 'review' && preview && (
                            <button
                                type="button"
                                className={primaryButton}
                                disabled={
                                    busy ||
                                    preview.problems.length > 0 ||
                                    preview.counts.create +
                                        preview.counts.update ===
                                        0
                                }
                                onClick={runImport}
                            >
                                {busy
                                    ? t(
                                          'spreadsheet.import.importing',
                                          'Importing…'
                                      )
                                    : t(
                                          'spreadsheet.import.importButton',
                                          'Import {{count}} rows',
                                          {
                                              count:
                                                  preview.counts.create +
                                                  preview.counts.update,
                                          }
                                      )}
                            </button>
                        )}
                        {step === 'done' && (
                            <>
                                {!undone &&
                                    !projectUid &&
                                    result?.project_uids.length === 1 && (
                                        <Link
                                            to={`/project/${result.project_uids[0]}`}
                                            className={secondaryButton}
                                            onClick={onClose}
                                        >
                                            {t(
                                                'spreadsheet.import.openProject',
                                                'Open the project'
                                            )}
                                        </Link>
                                    )}
                                <button
                                    type="button"
                                    className={primaryButton}
                                    onClick={onClose}
                                >
                                    {t('common.done', 'Done')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(body, document.body);
};

export default ImportWizard;
