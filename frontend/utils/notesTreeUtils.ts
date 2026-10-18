import { Note } from '../entities/Note';
import { Project } from '../entities/Project';

export interface ProjectFolderNode {
    kind: 'project';
    key: string;
    uid: string;
    name: string;
    color?: string;
    notes: Note[];
    count: number;
}

export interface NotesTreeData {
    rootFolders: ProjectFolderNode[];
    rootNotes: Note[];
}

export type TreeRow =
    | { type: 'section-header'; key: string; label: string }
    | {
          type: 'folder';
          key: string;
          label: string;
          color?: string;
          count: number;
          depth: number;
          expanded: boolean;
      }
    | { type: 'note'; key: string; note: Note; depth: number }
    | { type: 'more'; key: string; folderKey: string; count: number };

export interface NoteTagSummary {
    name: string;
    count: number;
}

const getNoteProject = (note: Note) => note.project || note.Project;
const getNoteProjectUid = (note: Note): string | undefined =>
    getNoteProject(note)?.uid || note.project_uid;

const compareLabels = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' });

export const sortNotesByOrder = (notes: Note[], orderBy: string): Note[] => {
    const [field, direction] = orderBy.split(':');
    const isAsc = direction === 'asc';

    return [...notes].sort((a, b) => {
        let valueA: string | number;
        let valueB: string | number;

        switch (field) {
            case 'title':
                valueA = a.title?.toLowerCase() || '';
                valueB = b.title?.toLowerCase() || '';
                break;
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
 * Filters notes by title for the sidebar's search box. Matching is
 * substring/case-insensitive against the title only - the tree is a quick
 * browse/peek list, not a full-text search.
 */
export const filterNotesByQuery = (notes: Note[], query: string): Note[] => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return notes;

    return notes.filter((note) =>
        (note.title || '').toLowerCase().includes(trimmed)
    );
};

/**
 * Builds the flat Project-folder / rootless-note structure for the notes
 * tree from data already available in the frontend stores. Projects are a
 * flat top level (no Area grouping) - a project only appears if it has at
 * least one note, so empty folders don't clutter what is a notes browser,
 * not a project browser.
 */
export const buildNotesTree = (
    notes: Note[],
    projects: Project[],
    orderBy: string
): NotesTreeData => {
    const projectsByUid = new Map<string, Project>();
    projects.forEach((project) => {
        if (project.uid) projectsByUid.set(project.uid, project);
    });

    const notesByProjectUid = new Map<string, Note[]>();
    const rootNotes: Note[] = [];

    notes.forEach((note) => {
        const projectUid = getNoteProjectUid(note);
        if (!projectUid) {
            rootNotes.push(note);
            return;
        }
        const list = notesByProjectUid.get(projectUid);
        if (list) {
            list.push(note);
        } else {
            notesByProjectUid.set(projectUid, [note]);
        }
    });

    const rootFolders: ProjectFolderNode[] = [];

    notesByProjectUid.forEach((projectNotes, projectUid) => {
        const project = projectsByUid.get(projectUid);
        const fallbackProject = getNoteProject(projectNotes[0]);
        const name = project?.name || fallbackProject?.name || projectUid;

        rootFolders.push({
            kind: 'project',
            key: `project:${projectUid}`,
            uid: projectUid,
            name,
            color: project?.color,
            notes: sortNotesByOrder(projectNotes, orderBy),
            count: projectNotes.length,
        });
    });

    rootFolders.sort((a, b) => compareLabels(a.name, b.name));

    return {
        rootFolders,
        rootNotes: sortNotesByOrder(rootNotes, orderBy),
    };
};

interface FlattenParams {
    tree: NotesTreeData;
    expanded: Record<string, boolean>;
    forceExpandAll: boolean;
    labels: { folders: string; noProject?: string };
    // Notes shown per open folder before a "N more" row. No limit if unset.
    folderLimit?: number;
    // Folders the user asked to see in full.
    showAll?: Record<string, boolean>;
}

export const NO_PROJECT_FOLDER_KEY = 'project:none';

const isExpanded = (
    key: string,
    expanded: Record<string, boolean>,
    forceExpandAll: boolean
) => (forceExpandAll ? true : !!expanded[key]);

/**
 * Turns the tree + current expand-state into the flat row array the
 * virtualized list renders. When `forceExpandAll` is set (an active search
 * query), every folder is shown expanded regardless of persisted state - the
 * tree passed in has already been filtered to matching notes only, so every
 * folder present here necessarily contains a match.
 */
export const flattenVisibleRows = ({
    tree,
    expanded,
    forceExpandAll,
    labels,
    folderLimit,
    showAll = {},
}: FlattenParams): TreeRow[] => {
    const rows: TreeRow[] = [];

    if (tree.rootFolders.length === 0 && tree.rootNotes.length === 0) {
        return rows;
    }

    rows.push({
        type: 'section-header',
        key: 'section:folders',
        label: labels.folders,
    });

    // With a noProject label, notes without a project get a folder of their
    // own at the end instead of sitting loose under the folders.
    const folders: Pick<
        ProjectFolderNode,
        'key' | 'name' | 'color' | 'notes' | 'count'
    >[] = labels.noProject
        ? tree.rootNotes.length > 0
            ? [
                  ...tree.rootFolders,
                  {
                      key: NO_PROJECT_FOLDER_KEY,
                      name: labels.noProject,
                      notes: tree.rootNotes,
                      count: tree.rootNotes.length,
                  },
              ]
            : tree.rootFolders
        : tree.rootFolders;

    folders.forEach((folder) => {
        const folderExpanded = isExpanded(folder.key, expanded, forceExpandAll);
        rows.push({
            type: 'folder',
            key: folder.key,
            label: folder.name,
            color: folder.color,
            count: folder.count,
            depth: 0,
            expanded: folderExpanded,
        });

        if (!folderExpanded) return;

        const limited =
            folderLimit !== undefined &&
            !forceExpandAll &&
            !showAll[folder.key] &&
            folder.notes.length > folderLimit;
        const visibleNotes = limited
            ? folder.notes.slice(0, folderLimit)
            : folder.notes;

        visibleNotes.forEach((note) => {
            rows.push({
                type: 'note',
                key: `note:${note.uid}`,
                note,
                depth: 1,
            });
        });

        if (limited) {
            rows.push({
                type: 'more',
                key: `more:${folder.key}`,
                folderKey: folder.key,
                count: folder.notes.length - visibleNotes.length,
            });
        }
    });

    if (labels.noProject) return rows;

    tree.rootNotes.forEach((note) => {
        rows.push({
            type: 'note',
            key: `root-note:${note.uid}`,
            note,
            depth: 0,
        });
    });

    return rows;
};

/**
 * Expand-state key for the folder containing a given note, used to seed the
 * tree's default expand state around the currently active note.
 */
export const getActiveFolderKeys = (
    note: Note | null | undefined
): string[] => {
    if (!note) return [];
    const projectUid = getNoteProjectUid(note);
    if (!projectUid) return [];

    return [`project:${projectUid}`];
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
