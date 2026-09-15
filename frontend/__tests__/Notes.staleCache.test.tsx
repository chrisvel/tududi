import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    fetchNoteBySlug: jest.fn(),
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

import { fetchNoteBySlug } from '../utils/notesService';

const mockFetchNoteBySlug = fetchNoteBySlug as jest.Mock;

const ownNote = {
    uid: 'own-note-1',
    title: 'My own note',
    content: 'Nothing to see here',
    updated_at: '2026-01-01T00:00:00Z',
};

const sharedNote = {
    uid: 'shared-note-1',
    title: 'Note shared with me',
    content: 'Belongs to the project owner',
    updated_at: '2026-01-02T00:00:00Z',
};

const baseStoreState: any = {
    notesStore: {
        // The global notes list was cached before the project (and this
        // note) was shared with the current user, so it only has their own
        // note in it - the shared note isn't there yet.
        notes: [ownNote],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        loadNotes: jest.fn(),
        setNotes: jest.fn(),
    },
    projectsStore: {
        projects: [],
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

const renderNotesAt = (uid: string) =>
    render(
        <MemoryRouter initialEntries={[`/notes/${uid}`]}>
            <Routes>
                <Route path="/notes" element={<Notes />} />
                <Route path="/notes/:uid" element={<Notes />} />
            </Routes>
        </MemoryRouter>
    );

describe('Notes stale-cache fallback (#1523)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        storeState = {
            ...baseStoreState,
            notesStore: {
                ...baseStoreState.notesStore,
                setNotes: jest.fn(),
            },
        };
    });

    it('fetches a note directly instead of opening the wrong one when it is missing from the cached list', async () => {
        mockFetchNoteBySlug.mockResolvedValue(sharedNote);

        renderNotesAt(sharedNote.uid);

        await waitFor(() => {
            expect(mockFetchNoteBySlug).toHaveBeenCalledWith(sharedNote.uid);
        });

        expect(await screen.findByText(sharedNote.title)).toBeInTheDocument();
        expect(screen.queryByText(ownNote.title)).not.toBeInTheDocument();
    });

    it('falls back to the first note only once the direct fetch confirms the note is unavailable', async () => {
        mockFetchNoteBySlug.mockRejectedValue(new Error('Not found'));

        renderNotesAt('does-not-exist');

        await waitFor(() => {
            expect(mockFetchNoteBySlug).toHaveBeenCalledWith('does-not-exist');
        });

        expect(await screen.findByText(ownNote.title)).toBeInTheDocument();
    });
});
