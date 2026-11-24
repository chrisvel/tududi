import { Note } from '../entities/Note';

export interface NoteTagSummary {
    name: string;
    count: number;
}

const getNoteProject = (note: Note) => note.project || note.Project;
const getNoteProjectUid = (note: Note): string | undefined =>
    getNoteProject(note)?.uid || note.project_uid;

const compareLabels = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

const sortableText = (note: Note, field: 'project' | 'tags'): string =>
    field === 'project'
        ? getNoteProject(note)?.name || ''
        : (note.tags || note.Tags || []).map((tag) => tag.name).join(' ');

export const sortNotesByOrder = (notes: Note[], orderBy: string): Note[] => {
    const [field, direction] = orderBy.split(':');
    const isAsc = direction === 'asc';

    return [...notes].sort((a, b) => {
        let valueA: string | number;
        let valueB: string | number;

        switch (field) {
            case 'title': {
                // Natural order, so "Note 9" comes before "Note 10".
                const order = (a.title || '').localeCompare(
                    b.title || '',
                    undefined,
                    { numeric: true, sensitivity: 'base' }
                );
                return isAsc ? order : -order;
            }
            case 'project':
            case 'tags': {
                const textA = sortableText(a, field);
                const textB = sortableText(b, field);
                // Rows without a value stay last in both directions.
                if (!textA || !textB) {
                    return textA ? -1 : textB ? 1 : 0;
                }
                const order = compareLabels(textA, textB);
                return isAsc ? order : -order;
            }
            case 'updated_at':
                valueA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                valueB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                break;
            case 'created_at':
            default:
                valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
                valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
                break;
        }

        if (valueA < valueB) return isAsc ? -1 : 1;
        if (valueA > valueB) return isAsc ? 1 : -1;
        return 0;
    });
};

/**
 * Full-text search for the notes table. Every word has to appear in the
 * title or the content, in any order.
 */
export const searchNotes = (notes: Note[], query: string): Note[] => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return notes;

    return notes.filter((note) => {
        const text = `${note.title || ''}\n${note.content || ''}`.toLowerCase();
        return words.every((word) => text.includes(word));
    });
};

// One line of plain text from a note's Markdown, for a table row.
export const getNotePreview = (
    content: string | null | undefined,
    maxLength = 160
): string => {
    if (!content) return '';
    const text = content
        .replace(/^(```|~~~).*$/gm, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(
            /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
            (_, target, __, label) => label || target
        )
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(
            /^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/gm,
            ''
        )
        .replace(/(\*\*|__|~~|`|\*)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const getNoteTags = (note: Note) => note.tags || note.Tags || [];

// The most recently edited notes, newest first.
export const getRecentNotes = (notes: Note[], limit: number): Note[] =>
    sortNotesByOrder(notes, 'updated_at:desc').slice(0, limit);

// Every tag used on these notes with how many notes carry it, most used
// first.
export const collectNoteTags = (notes: Note[]): NoteTagSummary[] => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
        getNoteTags(note).forEach((tag) => {
            if (!tag?.name) return;
            counts.set(tag.name, (counts.get(tag.name) || 0) + 1);
        });
    });

    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || compareLabels(a.name, b.name));
};

export const filterNotesByTag = (
    notes: Note[],
    tagName: string | null
): Note[] => {
    if (!tagName) return notes;
    return notes.filter((note) =>
        getNoteTags(note).some((tag) => tag?.name === tagName)
    );
};

// The Project filter's value for notes that have no project.
export const NO_PROJECT_FILTER = 'none';

// Notes in any of the projects. No values means no filter.
export const filterNotesByProjects = (
    notes: Note[],
    projectUids: string[]
): Note[] => {
    if (projectUids.length === 0) return notes;
    return notes.filter((note) =>
        projectUids.includes(getNoteProjectUid(note) || NO_PROJECT_FILTER)
    );
};

// Notes with any of the tags. No values means no filter.
export const filterNotesByTags = (
    notes: Note[],
    tagNames: string[]
): Note[] => {
    if (tagNames.length === 0) return notes;
    return notes.filter((note) =>
        getNoteTags(note).some((tag) => tagNames.includes(tag?.name))
    );
};

export const collectNoteProjects = (
    notes: Note[]
): { uid: string; name: string }[] => {
    const names = new Map<string, string>();
    notes.forEach((note) => {
        const project = getNoteProject(note);
        if (project?.uid) names.set(project.uid, project.name);
    });
    return [...names.entries()]
        .map(([uid, name]) => ({ uid, name }))
        .sort((a, b) => compareLabels(a.name, b.name));
};
