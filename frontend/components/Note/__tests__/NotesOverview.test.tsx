import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import NotesOverview from '../NotesOverview';
import { Note } from '../../../entities/Note';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            if (fallback && typeof fallback === 'object') {
                return String(fallback.defaultValue).replace(
                    '{{count}}',
                    fallback.count
                );
            }
            return fallback ?? options ?? key;
        },
    }),
}));

jest.mock('../../../utils/dateUtils', () => ({
    formatShortDate: (date: Date) => date.toISOString().slice(0, 10),
}));

let mockFocus: any = null;
jest.mock('../../../utils/focus', () => ({
    useFocus: () => mockFocus,
    noteMatchesFocus: (note: any, focus: any) =>
        note.project?.uid === focus.project_uid,
}));

const alpha = { id: 1, uid: 'p-alpha', name: 'Alpha' };

const notes: Note[] = [
    {
        uid: 'n1',
        title: 'Banana recipe',
        content: '# Heading\n\nMash the **bananas** well',
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
        project: alpha,
        tags: [{ name: 'food' } as any],
    },
    {
        uid: 'n2',
        title: 'Apple notes',
        content: 'Orchard visit',
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
        tags: [{ name: 'food' } as any, { name: 'trips' } as any],
    },
    {
        uid: 'n3',
        title: 'Cherry plan',
        content: 'Nothing about fruit salad',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-02-15T10:00:00Z',
    },
];

let mockStoreState: any;
jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) => selector(mockStoreState),
}));

const LocationProbe = () => {
    const location = useLocation();
    return (
        <div data-testid="location">{location.pathname + location.search}</div>
    );
};

const mockNewNote = jest.fn();

const renderOverview = (url = '/notes') =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route
                    path="/notes"
                    element={<NotesOverview onNewNote={mockNewNote} />}
                />
                <Route path="/notes/:uid" element={<div>editor</div>} />
            </Routes>
            <LocationProbe />
        </MemoryRouter>
    );

const titles = () =>
    within(screen.getAllByRole('rowgroup')[1])
        .getAllByRole('link')
        .map((link) => link.textContent);

const setStore = (overrides: any = {}) => {
    mockStoreState = {
        notesStore: {
            notes,
            isLoading: false,
            isError: false,
            hasLoaded: true,
            loadNotes: jest.fn(),
            ...overrides,
        },
        projectsStore: { projects: [alpha] },
    };
};

describe('NotesOverview', () => {
    beforeEach(() => {
        mockFocus = null;
        localStorage.clear();
        mockNewNote.mockClear();
        setStore();
    });

    it('lists notes most recently updated first, with a plain text preview', () => {
        renderOverview();
        expect(titles()).toEqual([
            'Banana recipe',
            'Cherry plan',
            'Apple notes',
        ]);
        expect(screen.getByText('Heading Mash the bananas well')).toBeTruthy();
    });

    it('sorts by a column and flips direction on a second click', () => {
        renderOverview();
        fireEvent.click(screen.getByRole('button', { name: 'Title' }));
        expect(titles()).toEqual([
            'Apple notes',
            'Banana recipe',
            'Cherry plan',
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Title' }));
        expect(titles()).toEqual([
            'Cherry plan',
            'Banana recipe',
            'Apple notes',
        ]);
    });

    it('sorts by project with notes without one last', () => {
        renderOverview();
        fireEvent.click(
            within(screen.getByTestId('notes-column-project')).getByRole(
                'button'
            )
        );
        expect(titles()[0]).toBe('Banana recipe');
    });

    it('remembers the sort across visits', () => {
        const { unmount } = renderOverview();
        fireEvent.click(screen.getByRole('button', { name: 'Title' }));
        unmount();
        renderOverview();
        expect(titles()[0]).toBe('Apple notes');
    });

    it('moves a column by dragging its heading, and remembers it', () => {
        const { unmount } = renderOverview();
        const dataTransfer = { setData: jest.fn(), effectAllowed: '' };
        fireEvent.dragStart(screen.getByTestId('notes-column-created_at'), {
            dataTransfer,
        });
        fireEvent.dragOver(screen.getByTestId('notes-column-title'), {
            dataTransfer,
        });
        fireEvent.drop(screen.getByTestId('notes-column-title'), {
            dataTransfer,
        });
        const expected = 'notes-column-created_at';
        expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute(
            'data-testid',
            expected
        );
        unmount();
        renderOverview();
        expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute(
            'data-testid',
            expected
        );
    });

    it('moves a column with Alt and an arrow key', () => {
        renderOverview();
        fireEvent.keyDown(screen.getByTestId('notes-resize-title'), {
            key: 'ArrowRight',
            altKey: true,
        });
        expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute(
            'data-testid',
            'notes-column-title'
        );
    });

    it('hides and shows columns other than the title, and remembers it', () => {
        const { unmount } = renderOverview();
        fireEvent.click(screen.getByTestId('notes-columns-button'));
        expect(
            screen.queryByTestId('notes-columns-toggle-title')
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId('notes-columns-toggle-preview')
        ).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByTestId('notes-columns-toggle-preview'));
        fireEvent.click(screen.getByTestId('notes-columns-toggle-tags'));
        expect(
            screen.queryByTestId('notes-column-preview')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('notes-column-tags')
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId('notes-columns-toggle-preview')
        ).toHaveAttribute('aria-checked', 'false');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(
            screen.queryByTestId('notes-columns-toggle-preview')
        ).not.toBeInTheDocument();

        unmount();
        renderOverview();
        expect(
            screen.queryByTestId('notes-column-preview')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('notes-column-title')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('notes-columns-button'));
        fireEvent.click(screen.getByTestId('notes-columns-toggle-tags'));
        expect(screen.getByTestId('notes-column-tags')).toBeInTheDocument();
    });

    it('ignores a saved hidden title', () => {
        localStorage.setItem(
            'tududi.notesTable',
            JSON.stringify({ hidden: ['title', 'project'] })
        );
        renderOverview();
        expect(screen.getByTestId('notes-column-title')).toBeInTheDocument();
        expect(
            screen.queryByTestId('notes-column-project')
        ).not.toBeInTheDocument();
    });

    it('moves a column past hidden ones with Alt and an arrow key', () => {
        localStorage.setItem(
            'tududi.notesTable',
            JSON.stringify({ hidden: ['preview'] })
        );
        renderOverview();
        fireEvent.keyDown(screen.getByTestId('notes-resize-title'), {
            key: 'ArrowRight',
            altKey: true,
        });
        expect(
            screen
                .getAllByRole('columnheader')
                .map((th) => th.getAttribute('data-testid'))
                .slice(0, 2)
        ).toEqual(['notes-column-project', 'notes-column-title']);
    });

    it('resizes a column by dragging its edge, down to a minimum, and resets on double click', () => {
        renderOverview();
        const col = () =>
            document.querySelectorAll('col')[0] as HTMLTableColElement;
        const handle = screen.getByTestId('notes-resize-title');
        jest.spyOn(
            handle.closest('th') as HTMLElement,
            'getBoundingClientRect'
        ).mockReturnValue({ width: 240 } as DOMRect);

        fireEvent(
            handle,
            new MouseEvent('pointerdown', { bubbles: true, clientX: 100 })
        );
        act(() => {
            window.dispatchEvent(
                new MouseEvent('pointermove', { clientX: 160 } as any)
            );
        });
        expect(col().style.width).toBe('300px');

        act(() => {
            window.dispatchEvent(
                new MouseEvent('pointermove', { clientX: -500 } as any)
            );
            window.dispatchEvent(new MouseEvent('pointerup'));
        });
        expect(col().style.width).toBe('70px');

        fireEvent.doubleClick(handle);
        expect(col().style.width).toBe('240px');
    });

    it('ignores unreadable saved columns', () => {
        localStorage.setItem(
            'tududi.notesTable',
            JSON.stringify({
                order: ['title'],
                widths: { title: 1 },
                sort: 'user_id:asc',
            })
        );
        renderOverview();
        expect(screen.getAllByRole('columnheader')).toHaveLength(6);
        expect(titles()[0]).toBe('Banana recipe');
    });

    it('sorts by created date, newest first on the first click', () => {
        renderOverview();
        fireEvent.click(screen.getByRole('button', { name: 'Created' }));
        expect(titles()).toEqual([
            'Cherry plan',
            'Apple notes',
            'Banana recipe',
        ]);
    });

    it('restores search and filters from the URL', () => {
        renderOverview('/notes?tag=food&q=a');
        expect(titles()).toEqual(['Banana recipe', 'Apple notes']);
        expect(screen.getByPlaceholderText(/Search titles/)).toHaveValue('a');
    });

    it('searches content as well as titles once typing settles', () => {
        jest.useFakeTimers();
        try {
            renderOverview();
            fireEvent.change(screen.getByPlaceholderText(/Search titles/), {
                target: { value: 'orchard' },
            });
            expect(titles()).toHaveLength(3);
            act(() => {
                jest.advanceTimersByTime(300);
            });
            expect(titles()).toEqual(['Apple notes']);
            expect(screen.getByTestId('location')).toHaveTextContent(
                'q=orchard'
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it('filters by several tags and several projects, keeping the menu open', () => {
        renderOverview();
        const tick = (option: string) =>
            fireEvent.click(screen.getByRole('option', { name: option }));

        fireEvent.click(screen.getByTestId('notes-tag-filter'));
        tick('trips');
        expect(titles()).toEqual(['Apple notes']);
        expect(screen.getByTestId('notes-tag-filter')).toHaveTextContent(
            'trips'
        );
        tick('food');
        expect(titles()).toEqual(['Banana recipe', 'Apple notes']);
        expect(screen.getByTestId('notes-tag-filter')).toHaveTextContent(
            'food +1'
        );
        expect(screen.getByTestId('location')).toHaveTextContent(
            'tag=trips&tag=food'
        );
        tick('trips');
        expect(titles()).toEqual(['Banana recipe', 'Apple notes']);
        tick('All tags');
        expect(titles()).toHaveLength(3);

        fireEvent.click(screen.getByTestId('notes-tag-filter'));
        fireEvent.click(screen.getByTestId('notes-project-filter'));
        tick('Alpha');
        tick('No project');
        expect(titles()).toEqual([
            'Banana recipe',
            'Cherry plan',
            'Apple notes',
        ]);
        tick('Alpha');
        expect(titles()).toEqual(['Cherry plan', 'Apple notes']);
    });

    it('restores several filter values from the URL', () => {
        renderOverview(
            '/notes?project=p-alpha&project=none&tag=trips&tag=gone'
        );
        expect(titles()).toEqual(['Apple notes']);
    });

    it('searches the tag and project menus even when they are short', () => {
        renderOverview();
        fireEvent.click(screen.getByTestId('notes-tag-filter'));
        fireEvent.change(screen.getByTestId('notes-tag-filter-search'), {
            target: { value: 'tri' },
        });
        expect(
            screen.queryByRole('option', { name: 'food' })
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('option', { name: 'trips' }));
        expect(titles()).toEqual(['Apple notes']);

        fireEvent.click(screen.getByTestId('notes-tag-filter'));
        fireEvent.click(screen.getByTestId('notes-project-filter'));
        expect(
            screen.getByTestId('notes-project-filter-search')
        ).toBeInTheDocument();
    });

    it('closes a filter menu on Escape', () => {
        renderOverview();
        fireEvent.click(screen.getByTestId('notes-tag-filter'));
        expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('drops a stale tag from the URL instead of showing nothing', () => {
        renderOverview('/notes?tag=gone');
        expect(titles()).toHaveLength(3);
    });

    it('does not show a note count', () => {
        renderOverview();
        expect(screen.queryByText(/\d+ notes?$/)).toBeNull();
    });

    it('keeps search behind the toggle unless the address has a search', () => {
        const { unmount } = renderOverview();
        const toggle = screen.getByTestId('notes-search-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByPlaceholderText(/Search titles/)).toHaveFocus();
        unmount();

        renderOverview('/notes?q=orchard');
        expect(screen.getByTestId('notes-search-toggle')).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('opens the note when its row is clicked', () => {
        renderOverview();
        fireEvent.click(screen.getByText('Heading Mash the bananas well'));
        expect(screen.getByText('editor')).toBeTruthy();
        expect(screen.getByTestId('location')).toHaveTextContent('/notes/n1');
    });

    it('follows the Focus', () => {
        mockFocus = { project_uid: 'p-alpha' };
        renderOverview();
        expect(titles()).toEqual(['Banana recipe']);
    });

    it('shows 100 rows until Show more is clicked', () => {
        setStore({
            notes: Array.from({ length: 150 }, (_, index) => ({
                uid: `n${index}`,
                title: `Note ${index}`,
                content: '',
            })),
        });
        renderOverview();
        expect(titles()).toHaveLength(100);
        fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
        expect(titles()).toHaveLength(150);
        expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });

    it('asks the page to start a new note', () => {
        renderOverview();
        fireEvent.click(screen.getByTestId('new-note-button'));
        expect(mockNewNote).toHaveBeenCalled();
    });
});
