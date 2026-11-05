import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// Spreadsheet import and export. An import is a job on the server: the file
// is uploaded and read once, the user maps columns and reviews a dry run,
// then commits it. A committed import can be undone for 7 days.

export type SpreadsheetFormat = 'xlsx' | 'csv';

export type ImportField =
    | 'uid'
    | 'name'
    | 'project'
    | 'area'
    | 'parent'
    | 'wbs'
    | 'status'
    | 'priority'
    | 'start'
    | 'due'
    | 'defer_until'
    | 'estimate'
    | 'assignee'
    | 'tags'
    | 'note'
    | 'completed_at';

export type ColumnTarget = ImportField | 'note_append' | 'ignore';

export const IMPORT_FIELDS: ImportField[] = [
    'name',
    'project',
    'area',
    'parent',
    'wbs',
    'status',
    'priority',
    'start',
    'due',
    'defer_until',
    'estimate',
    'assignee',
    'tags',
    'note',
    'completed_at',
    'uid',
];

export interface SheetColumns {
    header_row: number;
    headers: string[];
    sample: string[][];
    row_count: number;
    suggested_mapping: ColumnTarget[];
}

export interface ImportSheet extends SheetColumns {
    name: string;
    truncated: boolean;
    has_levels: boolean;
}

export interface ImportJob {
    uid: string;
    file_name: string;
    status: 'parsed' | 'committed' | 'undone';
    encoding: string | null;
    sheets: ImportSheet[];
}

// Code pages a CSV that is not UTF-8 can be re-read in, with the languages
// that use each.
export const CSV_ENCODINGS: { value: string; label: string }[] = [
    { value: 'win1252', label: 'Western European (Windows-1252)' },
    { value: 'win1250', label: 'Central European (Windows-1250)' },
    { value: 'win1251', label: 'Cyrillic (Windows-1251)' },
    { value: 'win1253', label: 'Greek (Windows-1253)' },
    { value: 'win1254', label: 'Turkish (Windows-1254)' },
    { value: 'win1256', label: 'Arabic (Windows-1256)' },
    { value: 'win1257', label: 'Baltic (Windows-1257)' },
    { value: 'win1258', label: 'Vietnamese (Windows-1258)' },
    { value: 'win874', label: 'Thai (Windows-874)' },
    { value: 'shift_jis', label: 'Japanese (Shift JIS)' },
    { value: 'gbk', label: 'Chinese Simplified (GBK)' },
    { value: 'big5', label: 'Chinese Traditional (Big5)' },
    { value: 'euc-kr', label: 'Korean (EUC-KR)' },
];

export type TargetMode = 'project' | 'new_project' | 'column' | 'none';
export type HierarchyMode = 'auto' | 'parent' | 'wbs' | 'indent' | 'flat';
export type DateOrder = 'auto' | 'dmy' | 'mdy';

export interface ImportOptions {
    sheet: number;
    header_row: number;
    mapping: ColumnTarget[];
    target: {
        mode: TargetMode;
        project_uid?: string | null;
        project_name?: string;
        area_uid?: string | null;
    };
    hierarchy: HierarchyMode;
    date_order: DateOrder;
    date_order_fallback: 'dmy' | 'mdy';
    value_map: {
        status: Record<string, number | ''>;
        priority: Record<string, number | ''>;
        assignee: Record<string, string>;
    };
    update_existing: boolean;
    clear_blanks: boolean;
}

export interface RowIssue {
    code: string;
    field?: string;
    value?: string;
}

export interface PreviewRow {
    row_number: number;
    action: 'create' | 'update' | 'skip';
    name: string;
    project: string | null | undefined;
    project_is_new: boolean;
    parent: string | null;
    status?: number;
    priority?: number | null;
    due?: string | null;
    start?: string | null;
    tags?: string[];
    errors: RowIssue[];
    warnings: RowIssue[];
}

export interface ImportPreview {
    problems: RowIssue[];
    counts: {
        create: number;
        update: number;
        skip: number;
        warnings: number;
        new_projects: number;
        new_areas: number;
        new_tags: number;
    };
    date_columns: Record<
        string,
        { detected: 'dmy' | 'mdy' | null; ambiguous: boolean }
    >;
    hierarchy_used: HierarchyMode;
    new_projects: string[];
    new_areas: string[];
    unknown_values: {
        status: string[];
        priority: string[];
        assignee: string[];
    };
    assignable: { uid: string; name: string }[];
    rows: PreviewRow[];
    total_rows: number;
}

export interface ImportCommitResult {
    uid: string;
    counts: {
        created: number;
        updated: number;
        skipped: number;
        new_projects: number;
        new_areas: number;
    };
    project_uids: string[];
}

export interface ImportHistoryItem {
    uid: string;
    file_name: string;
    status: 'committed' | 'undone';
    committed_at: string | null;
    undone_at: string | null;
    counts: ImportCommitResult['counts'] | null;
    can_undo: boolean;
}

// An error from these calls keeps the server's reason code, which the UI
// translates; the message is the English fallback.
export class SpreadsheetError extends Error {
    reason: string;

    constructor(message: string, reason: string) {
        super(message);
        this.reason = reason;
    }
}

const fallbackReasons: Record<string, string> = {
    'Could not export the tasks': 'export_failed',
    'Could not download the template': 'export_failed',
    'Could not read the file': 'read_failed',
    'Could not read the columns': 'read_failed',
    'Could not check the file': 'check_failed',
    'Could not import the file': 'import_failed',
    'Could not undo the import': 'undo_failed',
    'Could not cancel the import': 'request_failed',
    'Could not load imports': 'request_failed',
};

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return new SpreadsheetError(
        data.error || data.message || fallback,
        data.reason ||
            (response.status === 429
                ? 'rate_limited'
                : fallbackReasons[fallback] || 'request_failed')
    );
};

const send = async <T>(
    path: string,
    method: string,
    fallback: string,
    body?: unknown
): Promise<T> => {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers: {
            ...(body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...(method !== 'GET'
                ? { 'x-csrf-token': await getCsrfToken() }
                : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
        throw await readError(response, fallback);
    }
    return response.status === 204 ? (undefined as T) : response.json();
};

const download = async (path: string, fallback: string) => {
    const response = await fetch(getApiPath(path), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw await readError(response, fallback);
    }
    const disposition = response.headers.get('Content-Disposition') || '';
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || 'tasks';
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export const exportTasks = (
    format: SpreadsheetFormat,
    filters: {
        project_uid?: string;
        area_uid?: string;
        include_completed?: boolean;
    } = {}
) => {
    const params = new URLSearchParams({ format });
    if (filters.project_uid) params.set('project_uid', filters.project_uid);
    if (filters.area_uid) params.set('area_uid', filters.area_uid);
    if (filters.include_completed === false) {
        params.set('include_completed', 'false');
    }
    return download(`export/tasks?${params}`, 'Could not export the tasks');
};

export const downloadImportTemplate = (format: SpreadsheetFormat = 'xlsx') =>
    download(
        `export/template?format=${format}`,
        'Could not download the template'
    );

export const uploadImportFile = async (
    file: File,
    encoding?: string
): Promise<ImportJob> => {
    const formData = new FormData();
    if (encoding) formData.append('encoding', encoding);
    formData.append('file', file);
    const response = await fetch(getApiPath('imports'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': await getCsrfToken() },
        body: formData,
    });
    if (!response.ok) {
        throw await readError(response, 'Could not read the file');
    }
    return response.json();
};

export const loadImportColumns = (
    uid: string,
    sheet: number,
    headerRow: number | null
) =>
    send<SheetColumns>(
        `imports/${uid}/columns`,
        'POST',
        'Could not read the columns',
        { sheet, header_row: headerRow }
    );

export const previewImport = (uid: string, options: ImportOptions) =>
    send<ImportPreview>(
        `imports/${uid}/preview`,
        'POST',
        'Could not check the file',
        options
    );

export const commitImport = (uid: string, options: ImportOptions) =>
    send<ImportCommitResult>(
        `imports/${uid}/commit`,
        'POST',
        'Could not import the file',
        options
    );

export const undoImport = (uid: string) =>
    send<{ kept_changed: number }>(
        `imports/${uid}/undo`,
        'POST',
        'Could not undo the import'
    );

export const discardImport = (uid: string) =>
    send<void>(`imports/${uid}`, 'DELETE', 'Could not cancel the import');

export const listImports = () =>
    send<ImportHistoryItem[]>('imports', 'GET', 'Could not load imports');
