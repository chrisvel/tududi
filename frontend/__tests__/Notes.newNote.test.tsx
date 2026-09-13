import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Notes from '../components/Notes';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../components/Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../utils/notesService', () => ({
    createNote: jest.fn(),
    updateNote: jest.fn(),
}));

jest.mock('../components/Note/MarkdownEditor', () => ({
    __esModule: true,
    default: ({ value, onChange }: any) => (
        <textarea
            aria-label="markdown-editor"
            value={value}
            onChange={(e: any) => onChange(e.target.value)}
        />
    ),
}));

jest.mock('../components/Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({ content }: any) => <div>{content}</div>,
}));

jest.mock('../components/Note/NoteModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../components/Note/NoteFocusMode', () => ({
    __esModule: true,
    default: () => null,
}));

import { createNote, updateNote } from '../utils/notesService';

const mockCreateNote = createNote as jest.Mock;
const mockUpdateNote = updateNote as jest.Mock;

const baseStoreState: any = {
    notesStore: {
        notes: [],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        loadNotes: jest.fn(),
        setNotes: jest.fn(),
    },
    projectsStore: {
        projects: [{ id: 1, uid: 'p1', name: 'Project 1' }],
    },
    tagsStore: {
        tags: [],
        addNewTags: jest.fn(),
        getTags: jest.fn(() => []),
    },
};

let storeState: any = baseStoreState;

jest.mock('../store/useStore', () => {
    const mockUseStore: any = (selector?: any) =>
        selector ? selector(storeState) : storeState;
    mockUseStore.getState = () => storeState;
    return { useStore: mockUseStore };
});

const renderNotes = (initialState: any) =>
    render(
        <MemoryRouter
            initialEntries={[{ pathname: '/notes', state: initialState }]}
        >
            <Routes>
                <Route path="/notes" element={<Notes />} />
                <Route path="/notes/:uid" element={<Notes />} />
            </Routes>
        </MemoryRouter>
    );

describe('Notes new-note flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        storeState = {
            ...baseStoreState,
            notesStore: { ...baseStoreState.notesStore },
        };
        mockCreateNote.mockResolvedValue({
            uid: 'n1',
            title: 'Groceries',
            content: '',
            updated_at: '2026-01-01T00:00:00Z',
        });
        mockUpdateNote.mockResolvedValue({
            uid: 'n1',
            title: 'Groceries',
            content: '',
            updated_at: '2026-01-01T00:00:00Z',
        });
    });

    it('opens a blank inline editor instead of a modal when navigated with the newNote flag', () => {
        renderNotes({ newNote: 12345 });

        // Inline editor is open with an empty title input
        const titleInput = screen.getByPlaceholderText(
            'notes.titlePlaceholder'
        );
        expect(titleInput).toBeInTheDocument();
        expect(titleInput).toHaveValue('');

        // Opening the editor must not persist a blank note yet
        expect(mockCreateNote).not.toHaveBeenCalled();
        expect(mockUpdateNote).not.toHaveBeenCalled();
    });

    it('opens a blank inline editor without the newNote flag state (direct entry)', () => {
        renderNotes(null);

        expect(
            screen.queryByPlaceholderText('notes.titlePlaceholder')
        ).not.toBeInTheDocument();
    });

    it('persists the note when the user saves with a title, then shows it in preview', async () => {
        const user = userEvent.setup();
        const { unmount } = renderNotes({ newNote: 12345 });

        await user.type(
            screen.getByPlaceholderText('notes.titlePlaceholder'),
            'Groceries'
        );

        // Open the note options dropdown, then Save (act-wrapped so the
        // navigate() inside the async save handler doesn't warn)
        await act(async () => {
            await user.click(screen.getByLabelText('notes.noteOptions'));
        });
        await act(async () => {
            await user.click(screen.getByRole('button', { name: 'Save' }));
        });

        await waitFor(() => {
            expect(mockCreateNote).toHaveBeenCalledTimes(1);
        });
        expect(mockCreateNote).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Groceries',
                content: '',
            })
        );

        // Editor exits into preview mode showing the saved note
        expect(await screen.findByText('Groceries')).toBeInTheDocument();

        // Let the 1s autosave debounce flush so no timer is pending at
        // teardown (prevents the jest force-exit warning).
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1100));
        });

        unmount();
    });
});
