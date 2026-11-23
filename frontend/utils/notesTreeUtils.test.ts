import {
    NO_PROJECT_FILTER,
    collectNoteProjects,
    collectNoteTags,
    filterNotesByProjects,
    filterNotesByTag,
    filterNotesByTags,
    getNotePreview,
    getRecentNotes,
    searchNotes,
    sortNotesByOrder,
} from './notesTreeUtils';
import { Note } from '../entities/Note';

const makeNote = (overrides: Partial<Note>): Note => ({
    uid: 'note-uid',
    title: 'Untitled',
    content: '',
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

describe('getRecentNotes', () => {
    it('returns the most recently edited notes first, up to the limit', () => {
        const notes = [
            makeNote({ uid: 'old', updated_at: '2026-01-01' }),
            makeNote({ uid: 'new', updated_at: '2026-03-01' }),
            makeNote({ uid: 'mid', updated_at: '2026-02-01' }),
        ];

        expect(getRecentNotes(notes, 2).map((n) => n.uid)).toEqual([
            'new',
            'mid',
        ]);
    });
});

describe('note tags', () => {
    const notes = [
        makeNote({ uid: 'n1', tags: [{ name: 'ideas' }, { name: 'work' }] }),
        makeNote({ uid: 'n2', Tags: [{ name: 'work' }] }),
        makeNote({ uid: 'n3' }),
    ];

    it('counts tags across notes, most used first', () => {
        expect(collectNoteTags(notes)).toEqual([
            { name: 'work', count: 2 },
            { name: 'ideas', count: 1 },
        ]);
    });

    it('filters notes by tag name, under either association key', () => {
        expect(filterNotesByTag(notes, 'work').map((n) => n.uid)).toEqual([
            'n1',
            'n2',
        ]);
        expect(filterNotesByTag(notes, null)).toHaveLength(3);
    });
});

describe('searchNotes', () => {
    const notes = [
        makeNote({
            uid: 'a',
            title: 'Roof quote',
            content: 'From the builder',
        }),
        makeNote({
            uid: 'b',
            title: 'Builder call',
            content: 'About the roof',
        }),
        makeNote({ uid: 'c', title: 'Groceries', content: null as any }),
    ];

    it('returns every note for an empty query', () => {
        expect(searchNotes(notes, '   ')).toHaveLength(3);
    });

    it('needs every word, across title and content, in any order', () => {
        expect(searchNotes(notes, 'ROOF builder').map((n) => n.uid)).toEqual([
            'a',
            'b',
        ]);
        expect(searchNotes(notes, 'roof groceries')).toEqual([]);
    });
});

describe('getNotePreview', () => {
    it('turns Markdown into one line of plain text', () => {
        expect(
            getNotePreview(
                '# Title\n\n- [x] **done** item\n> quote with [a link](http://x.y)\n![pic](a.png)\n```js\nrun()\n```\nSee [[Other note]] and [[Target|label]]'
            )
        ).toBe(
            'Title done item quote with a link run() See Other note and label'
        );
    });

    it('cuts long content and survives no content', () => {
        expect(getNotePreview('a'.repeat(200), 10)).toBe('aaaaaaaaaa...');
        expect(getNotePreview(null)).toBe('');
    });
});

describe('filterNotesByProjects, filterNotesByTags and collectNoteProjects', () => {
    const zed = { id: 1, uid: 'z', name: 'zed' };
    const able = { id: 2, uid: 'a', name: 'Able' };
    const notes = [
        makeNote({ uid: '1', project: zed }),
        makeNote({ uid: '2', Project: able }),
        makeNote({ uid: '3', project: zed }),
        makeNote({ uid: '4' }),
    ];

    it('keeps notes in any of the projects, including no project', () => {
        const uids = (values: string[]) =>
            filterNotesByProjects(notes, values).map((n) => n.uid);
        expect(uids(['z'])).toEqual(['1', '3']);
        expect(uids([NO_PROJECT_FILTER])).toEqual(['4']);
        expect(uids(['a', NO_PROJECT_FILTER])).toEqual(['2', '4']);
        expect(uids([])).toHaveLength(4);
    });

    it('keeps notes with any of the tags', () => {
        const tagged = [
            makeNote({ uid: 'x', tags: [{ name: 'a' } as any] }),
            makeNote({ uid: 'y', Tags: [{ name: 'b' } as any] }),
            makeNote({ uid: 'z' }),
        ];
        expect(filterNotesByTags(tagged, ['a', 'b']).map((n) => n.uid)).toEqual(
            ['x', 'y']
        );
        expect(filterNotesByTags(tagged, [])).toHaveLength(3);
    });

    it('lists each project once, by name', () => {
        expect(collectNoteProjects(notes)).toEqual([
            { uid: 'a', name: 'Able' },
            { uid: 'z', name: 'zed' },
        ]);
    });
});

describe('sortNotesByOrder for the table columns', () => {
    const notes = [
        makeNote({
            uid: 'a',
            title: 'Note 10',
            project: { id: 1, name: 'Zed' },
        }),
        makeNote({
            uid: 'b',
            title: 'Note 9',
            tags: [{ name: 'alpha' } as any],
        }),
        makeNote({
            uid: 'c',
            title: 'note 100',
            Project: { id: 2, name: 'Able' },
        }),
    ];
    const uids = (order: string) =>
        sortNotesByOrder(notes, order).map((n) => n.uid);

    it('sorts titles in natural order', () => {
        expect(uids('title:asc')).toEqual(['b', 'a', 'c']);
        expect(uids('title:desc')).toEqual(['c', 'a', 'b']);
    });

    it('sorts by project and tags, with empty values last both ways', () => {
        expect(uids('project:asc')).toEqual(['c', 'a', 'b']);
        expect(uids('project:desc')).toEqual(['a', 'c', 'b']);
        expect(uids('tags:desc')[0]).toBe('b');
    });
});
