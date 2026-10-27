'use strict';

const { allTranslations } = require('./locales');

// The task fields a spreadsheet column can feed, in export order. `label`
// is the translation key used for the exported header; `synonyms` are
// English headers other tools and hand-made sheets use, most specific first.
// Exported headers in any language are matched too.
const FIELDS = [
    {
        key: 'uid',
        label: 'spreadsheet.columns.uid',
        synonyms: ['uid', 'task uid', 'task id', 'id', 'item id'],
    },
    {
        key: 'name',
        label: 'spreadsheet.columns.name',
        synonyms: [
            'name',
            'task name',
            'task',
            'title',
            'item name',
            'item',
            'subject',
            'summary',
            'activity',
            'work item',
            'to do',
            'todo',
        ],
    },
    {
        key: 'project',
        label: 'spreadsheet.columns.project',
        synonyms: [
            'project',
            'project name',
            'projects',
            'board',
            'list name',
            'list',
            'development',
            'job',
            'site',
        ],
    },
    {
        key: 'area',
        label: 'spreadsheet.columns.area',
        synonyms: [
            'area',
            'area name',
            'space',
            'folder',
            'folder name',
            'category',
        ],
    },
    {
        key: 'parent',
        label: 'spreadsheet.columns.parentUid',
        synonyms: [
            'parent uid',
            'parent id',
            'parent task id',
            'parent',
            'parent task',
            'parent name',
            'subtask of',
        ],
    },
    {
        key: 'wbs',
        label: 'spreadsheet.columns.wbs',
        synonyms: ['wbs', 'outline number', 'outline', 'outline level'],
    },
    {
        key: 'status',
        label: 'spreadsheet.columns.status',
        synonyms: [
            'status',
            'state',
            'stage',
            'task status',
            'progress',
            'done',
            'completed',
            'complete',
        ],
    },
    {
        key: 'priority',
        label: 'spreadsheet.columns.priority',
        synonyms: ['priority', 'importance', 'urgency'],
    },
    {
        key: 'start',
        label: 'spreadsheet.columns.start',
        synonyms: [
            'start',
            'start date',
            'starts',
            'start time',
            'begin',
            'begin date',
            'start on',
        ],
    },
    {
        key: 'due',
        label: 'spreadsheet.columns.due',
        synonyms: [
            'due',
            'due date',
            'deadline',
            'due on',
            'end',
            'end date',
            'finish',
            'finish date',
            'target date',
            'date',
        ],
    },
    {
        key: 'defer_until',
        label: 'spreadsheet.columns.deferUntil',
        synonyms: ['defer until', 'defer', 'show from', 'hide until'],
    },
    {
        key: 'estimate',
        label: 'spreadsheet.columns.estimate',
        synonyms: [
            'estimate',
            'estimated minutes',
            'estimated time',
            'time estimate',
            'estimated hours',
            'effort',
            'time estimate (min)',
            'estimate (min)',
            'duration',
        ],
    },
    {
        key: 'assignee',
        label: 'spreadsheet.columns.assignee',
        synonyms: [
            'assignee',
            'assigned to',
            'assigned',
            'owner',
            'responsible',
            'person',
            'who',
            'assignees',
            'assignee email',
            'owner email',
        ],
    },
    {
        key: 'tags',
        label: 'spreadsheet.columns.tags',
        synonyms: ['tags', 'tag', 'labels', 'label', 'keywords'],
    },
    {
        key: 'note',
        label: 'spreadsheet.columns.note',
        synonyms: [
            'note',
            'notes',
            'description',
            'details',
            'body',
            'content',
            'comments',
            'task content',
            'task description',
        ],
    },
    {
        key: 'completed_at',
        label: 'spreadsheet.columns.completedAt',
        synonyms: [
            'completed at',
            'completion date',
            'date completed',
            'completed on',
            'done on',
        ],
    },
];

const FIELD_KEYS = FIELDS.map((f) => f.key);

// Column targets that are not task fields: dropping a column, or keeping
// it in the task's note as "Header: value" so nothing in the sheet is lost.
const IGNORE = 'ignore';
const APPEND_TO_NOTE = 'note_append';

// Headers that only appear in exports and carry nothing worth importing.
const EXPORT_ONLY_LABELS = ['spreadsheet.columns.createdAt'];

// Other tools export their own ids under the same headers ("Task ID"), and
// those must not be read as tududi task UIDs.
const TUDUDI_UID = /^[0-9a-km-z]{15}$/;

function looksLikeUids(rows, column) {
    const values = rows
        .map((row) => String(row[column] ?? '').trim())
        .filter(Boolean);
    if (values.length === 0) return false;
    const matching = values.filter((v) => TUDUDI_UID.test(v)).length;
    return matching * 2 >= values.length;
}

function normalizeHeader(header) {
    return String(header ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[_\-./:()[\]#*]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

let headerIndex = null;

// normalized header -> [{ field, rank }], lowest rank wins.
function getHeaderIndex() {
    if (headerIndex) return headerIndex;
    headerIndex = new Map();
    const add = (header, field, rank) => {
        const key = normalizeHeader(header);
        if (!key) return;
        const list = headerIndex.get(key) || [];
        if (!list.some((e) => e.field === field)) list.push({ field, rank });
        headerIndex.set(key, list);
    };
    for (const field of FIELDS) {
        for (const label of allTranslations(field.label)) {
            add(label, field.key, 0);
        }
        if (field.key === 'parent') {
            // Exports carry the parent's name next to its uid; the uid is
            // what re-imports, the name is for people reading the sheet.
            for (const label of allTranslations('spreadsheet.columns.parent')) {
                add(label, field.key, 1);
            }
        }
        field.synonyms.forEach((synonym, i) => add(synonym, field.key, i + 1));
    }
    for (const labelKey of EXPORT_ONLY_LABELS) {
        for (const label of allTranslations(labelKey)) add(label, IGNORE, 0);
    }
    return headerIndex;
}

// Suggests a target for every column. Each field goes to the header that
// matches it best, and a second header for a field already taken is
// dropped. Unknown columns are kept in the note when they hold anything, so
// a "Contractor" column still survives the import.
function suggestMapping(headers, rows = []) {
    const index = getHeaderIndex();
    const candidates = [];
    headers.forEach((header, column) => {
        for (const { field, rank } of index.get(normalizeHeader(header)) ||
            []) {
            candidates.push({ column, field, rank });
        }
    });
    candidates.sort((a, b) => a.rank - b.rank || a.column - b.column);

    const mapping = headers.map(() => null);
    const recognized = new Set(candidates.map((c) => c.column));
    const takenFields = new Set();
    for (const { column, field } of candidates) {
        if (mapping[column] !== null) continue;
        if (field === 'uid' && !looksLikeUids(rows, column)) continue;
        if (field !== IGNORE && takenFields.has(field)) continue;
        mapping[column] = field;
        if (field !== IGNORE) takenFields.add(field);
    }

    return mapping.map((field, column) => {
        if (field) return field;
        if (recognized.has(column)) return IGNORE;
        const hasValues = rows.some((row) => String(row[column] ?? '').trim());
        return hasValues && String(headers[column] ?? '').trim()
            ? APPEND_TO_NOTE
            : IGNORE;
    });
}

module.exports = {
    FIELDS,
    FIELD_KEYS,
    IGNORE,
    APPEND_TO_NOTE,
    normalizeHeader,
    suggestMapping,
};
