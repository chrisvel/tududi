import {
    buildNotesTree,
    filterNotesByQuery,
    flattenVisibleRows,
    getActiveFolderKeys,
    sortNotesByOrder,
} from './notesTreeUtils';
import { Note } from '../entities/Note';
import { Project } from '../entities/Project';

const makeNote = (overrides: Partial<Note>): Note => ({
    uid: 'note-uid',
    title: 'Untitled',
    content: '',
    ...overrides,
});

const makeProject = (overrides: Partial<Project>): Project => ({
    uid: 'project-uid',
    name: 'Project',
    ...overrides,
});

describe('sortNotesByOrder', () => {
    const notes = [
        makeNote({ uid: 'b', title: 'Banana', created_at: '2026-01-02' }),
        makeNote({ uid: 'a', title: 'Apple', created_at: '2026-01-03' }),
        makeNote({ uid: 'c', title: 'Cherry', created_at: '2026-01-01' }),
    ];

    it('sorts by title ascending', () => {
        const sorted = sortNotesByOrder(notes, 'title:asc');
        expect(sorted.map((n) => n.uid)).toEqual(['a', 'b', 'c']);
    });

    it('sorts by created_at descending (default)', () => {
        const sorted = sortNotesByOrder(notes, 'created_at:desc');
        expect(sorted.map((n) => n.uid)).toEqual(['a', 'b', 'c']);
    });
});

describe('filterNotesByQuery', () => {
    const notes = [
        makeNote({ uid: 'a', title: 'Grocery List' }),
        makeNote({ uid: 'b', title: 'Meeting Notes' }),
        makeNote({ uid: 'c', title: 'Recipe Ideas' }),
    ];

    it('returns all notes when the query is empty', () => {
        expect(filterNotesByQuery(notes, '')).toEqual(notes);
        expect(filterNotesByQuery(notes, '   ')).toEqual(notes);
    });

    it('matches titles case-insensitively as a substring', () => {
        const result = filterNotesByQuery(notes, 'grocery');
        expect(result.map((n) => n.uid)).toEqual(['a']);
    });

    it('matches multiple notes sharing a substring', () => {
        const result = filterNotesByQuery(notes, 'e');
        expect(result.map((n) => n.uid)).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array when nothing matches', () => {
        expect(filterNotesByQuery(notes, 'zzz')).toEqual([]);
    });

    it('treats a missing title as unmatched', () => {
        const untitled = [makeNote({ uid: 'd', title: '' })];
        expect(filterNotesByQuery(untitled, 'grocery')).toEqual([]);
    });
});

describe('buildNotesTree', () => {
    const area = { uid: 'area-1', name: 'Work', color: '#4287f5' };
    const projectInArea = makeProject({
        uid: 'proj-1',
        name: 'Website Redesign',
        color: '#f5a442',
        area,
    });
    const projectNoArea = makeProject({ uid: 'proj-2', name: 'Blog' });
    const emptyProject = makeProject({ uid: 'proj-3', name: 'No Notes Here' });
    const projects = [projectInArea, projectNoArea, emptyProject];

    it('puts projects as flat top-level folders, ignoring their area', () => {
        const notes = [
            makeNote({ uid: 'n1', project_uid: 'proj-1' }),
            makeNote({ uid: 'n2', project_uid: 'proj-1' }),
        ];

        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        expect(tree.rootFolders).toHaveLength(1);
        const projectFolder = tree.rootFolders[0];
        expect(projectFolder.kind).toBe('project');
        expect(projectFolder.name).toBe('Website Redesign');
        expect(projectFolder.count).toBe(2);
    });

    it('carries the project color onto its folder node', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-1' })];

        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        expect(tree.rootFolders[0].color).toBe('#f5a442');
    });

    it('sorts project folders alphabetically regardless of area', () => {
        const notes = [
            makeNote({ uid: 'n1', project_uid: 'proj-1' }),
            makeNote({ uid: 'n2', project_uid: 'proj-2' }),
        ];

        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        expect(tree.rootFolders.map((f) => f.name)).toEqual([
            'Blog',
            'Website Redesign',
        ]);
    });

    it('resolves the project name even when Sequelize returns it under the capitalized `Area` key', () => {
        // Project.belongsTo(Area) has no `as` alias, so the API can return
        // the association as `Area` (Sequelize default) instead of `area`.
        // Area grouping no longer matters, but the project itself must
        // still resolve correctly regardless of that casing.
        const projectWithCapitalizedArea = makeProject({
            uid: 'proj-4',
            name: 'Legacy Migration',
        }) as Project & { Area?: typeof area };
        projectWithCapitalizedArea.Area = area;
        delete projectWithCapitalizedArea.area;

        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-4' })];

        const tree = buildNotesTree(
            notes,
            [projectWithCapitalizedArea],
            'created_at:desc'
        );

        expect(tree.rootFolders).toHaveLength(1);
        expect(tree.rootFolders[0].kind).toBe('project');
        expect(tree.rootFolders[0].name).toBe('Legacy Migration');
    });

    it('omits projects that have no notes', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-2' })];

        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        const names = tree.rootFolders.map((f) => f.name);
        expect(names).toEqual(['Blog']);
        expect(names).not.toContain('No Notes Here');
    });

    it('puts notes with no project at the tree root as leaves', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: undefined })];

        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        expect(tree.rootFolders).toHaveLength(0);
        expect(tree.rootNotes.map((n) => n.uid)).toEqual(['n1']);
    });
});

describe('flattenVisibleRows', () => {
    const labels = { folders: 'Folders' };

    it('shows only top-level folder rows when nothing is expanded', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-2' })];
        const projects = [makeProject({ uid: 'proj-2', name: 'Blog' })];
        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        const rows = flattenVisibleRows({
            tree,
            expanded: {},
            forceExpandAll: false,
            labels,
        });

        expect(rows.map((r) => r.type)).toEqual(['section-header', 'folder']);
    });

    it('carries the folder color through onto the flattened row', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-2' })];
        const projects = [
            makeProject({ uid: 'proj-2', name: 'Blog', color: '#123abc' }),
        ];
        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        const rows = flattenVisibleRows({
            tree,
            expanded: {},
            forceExpandAll: false,
            labels,
        });

        const folderRow = rows.find((r) => r.type === 'folder');
        expect(folderRow && 'color' in folderRow && folderRow.color).toBe(
            '#123abc'
        );
    });

    it('reveals leaf notes once a folder is expanded', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-2' })];
        const projects = [makeProject({ uid: 'proj-2', name: 'Blog' })];
        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        const rows = flattenVisibleRows({
            tree,
            expanded: { 'project:proj-2': true },
            forceExpandAll: false,
            labels,
        });

        expect(rows.map((r) => r.type)).toEqual([
            'section-header',
            'folder',
            'note',
        ]);
    });

    it('force-expands every folder while a search is active', () => {
        const notes = [makeNote({ uid: 'n1', project_uid: 'proj-2' })];
        const projects = [makeProject({ uid: 'proj-2', name: 'Blog' })];
        const tree = buildNotesTree(notes, projects, 'created_at:desc');

        const rows = flattenVisibleRows({
            tree,
            expanded: {},
            forceExpandAll: true,
            labels,
        });

        expect(rows.map((r) => r.type)).toEqual([
            'section-header',
            'folder',
            'note',
        ]);
    });

    it('returns no rows when the tree is empty', () => {
        const tree = buildNotesTree([], [], 'created_at:desc');

        const rows = flattenVisibleRows({
            tree,
            expanded: {},
            forceExpandAll: false,
            labels,
        });

        expect(rows).toEqual([]);
    });
});

describe('getActiveFolderKeys', () => {
    it('returns the project key for a note in a project', () => {
        const note = makeNote({ uid: 'n1', project_uid: 'proj-1' });

        expect(getActiveFolderKeys(note)).toEqual(['project:proj-1']);
    });

    it('returns no keys for a note with no project', () => {
        expect(getActiveFolderKeys(makeNote({ uid: 'n1' }))).toEqual([]);
    });

    it('returns no keys when there is no active note', () => {
        expect(getActiveFolderKeys(null)).toEqual([]);
    });
});
