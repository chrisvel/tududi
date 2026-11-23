import { useCallback, useEffect, useState } from 'react';

export type NoteColumnId =
    'title' | 'preview' | 'project' | 'tags' | 'updated_at' | 'created_at';

export const NOTE_COLUMN_WIDTHS: Record<NoteColumnId, number> = {
    title: 240,
    preview: 240,
    project: 130,
    tags: 170,
    updated_at: 115,
    created_at: 115,
};
export const MIN_COLUMN_WIDTH = 70;
export const DEFAULT_SORT = 'updated_at:desc';

const STORAGE_KEY = 'tududi.notesTable';
const COLUMN_IDS = Object.keys(NOTE_COLUMN_WIDTHS) as NoteColumnId[];
const SORT_FIELDS = ['title', 'project', 'tags', 'updated_at', 'created_at'];
// The title opens the note, so it always shows.
export const HIDEABLE_COLUMNS: NoteColumnId[] = COLUMN_IDS.filter(
    (id) => id !== 'title'
);

interface TablePrefs {
    order: NoteColumnId[];
    widths: Partial<Record<NoteColumnId, number>>;
    sort: string;
    hidden: NoteColumnId[];
}

const isValidSort = (sort: unknown): sort is string => {
    if (typeof sort !== 'string') return false;
    const [field, direction] = sort.split(':');
    return SORT_FIELDS.includes(field) && ['asc', 'desc'].includes(direction);
};

const loadPrefs = (): TablePrefs => {
    const prefs: TablePrefs = {
        order: COLUMN_IDS,
        widths: {},
        sort: DEFAULT_SORT,
        hidden: [],
    };
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (
            Array.isArray(stored.order) &&
            stored.order.length === COLUMN_IDS.length &&
            COLUMN_IDS.every((id) => stored.order.includes(id))
        ) {
            prefs.order = stored.order;
        }
        COLUMN_IDS.forEach((id) => {
            const width = stored.widths?.[id];
            if (typeof width === 'number' && width >= MIN_COLUMN_WIDTH) {
                prefs.widths[id] = width;
            }
        });
        if (isValidSort(stored.sort)) prefs.sort = stored.sort;
        if (Array.isArray(stored.hidden)) {
            prefs.hidden = HIDEABLE_COLUMNS.filter((id) =>
                stored.hidden.includes(id)
            );
        }
    } catch {
        // Unreadable or blocked storage: the defaults are fine.
    }
    return prefs;
};

// Sort, column order, widths and hidden columns for the notes table, kept per browser.
export const useNotesTableColumns = () => {
    const [prefs, setPrefs] = useState<TablePrefs>(loadPrefs);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Not remembered this time.
        }
    }, [prefs]);

    const setSort = useCallback((sort: string) => {
        setPrefs((current) => ({ ...current, sort }));
    }, []);

    // The column lands where the target was, so dragging right drops it after
    // the target and dragging left before it.
    const moveColumn = useCallback(
        (id: NoteColumnId, targetId: NoteColumnId) => {
            setPrefs((current) => {
                const order = current.order.filter((c) => c !== id);
                order.splice(current.order.indexOf(targetId), 0, id);
                return { ...current, order };
            });
        },
        []
    );

    const resizeColumn = useCallback((id: NoteColumnId, width: number) => {
        setPrefs((current) => ({
            ...current,
            widths: {
                ...current.widths,
                [id]: Math.max(MIN_COLUMN_WIDTH, Math.round(width)),
            },
        }));
    }, []);

    const resetColumnWidth = useCallback((id: NoteColumnId) => {
        setPrefs((current) => {
            const widths = { ...current.widths };
            delete widths[id];
            return { ...current, widths };
        });
    }, []);

    const toggleColumn = useCallback((id: NoteColumnId) => {
        if (!HIDEABLE_COLUMNS.includes(id)) return;
        setPrefs((current) => ({
            ...current,
            hidden: current.hidden.includes(id)
                ? current.hidden.filter((c) => c !== id)
                : [...current.hidden, id],
        }));
    }, []);

    return {
        ...prefs,
        setSort,
        moveColumn,
        resizeColumn,
        resetColumnWidth,
        toggleColumn,
    };
};
