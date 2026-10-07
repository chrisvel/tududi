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

const linkedNote = {
    uid: 'linked-note-1',
    title: 'Linked note',
    content: 'Opened from a link',
    updated_at: '2026-01-01T00:00:00Z',
};

let storeState: any;

jest.mock('../store/useStore', () => {
    const mockUseStore: any = (selector?: any) =>
        selector ? selector(storeState) : storeState;
    mockUseStore.getState = () => storeState;
    return { useStore: mockUseStore };
});

describe('Notes opened by link (#1785)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // The full notes list is still loading.
        storeState = {
            notesStore: {
                notes: [],
                isLoading: true,
                isError: false,
                hasLoaded: false,
                loadNotes: jest.fn(),
                setNotes: jest.fn(),
            },
            projectsStore: { projects: [] },
            tagsStore: {
                tags: [],
                addNewTags: jest.fn(),
                getTags: jest.fn(() => []),
            },
        };
    });

    it('shows the linked note without waiting for the notes list', async () => {
        mockFetchNoteBySlug.mockResolvedValue(linkedNote);

        render(
            <MemoryRouter initialEntries={[`/notes/${linkedNote.uid}`]}>
                <Routes>
                    <Route path="/notes/:uid" element={<Notes />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNoteBySlug).toHaveBeenCalledWith(linkedNote.uid);
        });
        expect(
            await screen.findByDisplayValue(linkedNote.title)
        ).toBeInTheDocument();
        expect(screen.queryByText('notes.loading')).not.toBeInTheDocument();
    });

    it('keeps the pane empty while the linked note loads', async () => {
        let resolveNote: (note: typeof linkedNote) => void = () => {};
        mockFetchNoteBySlug.mockReturnValue(
            new Promise((resolve) => {
                resolveNote = resolve;
            })
        );

        render(
            <MemoryRouter initialEntries={[`/notes/${linkedNote.uid}`]}>
                <Routes>
                    <Route path="/notes/:uid" element={<Notes />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.queryByText('notes.loading')).not.toBeInTheDocument();
        expect(screen.queryByText('No notes yet.')).not.toBeInTheDocument();

        resolveNote(linkedNote);
        expect(
            await screen.findByDisplayValue(linkedNote.title)
        ).toBeInTheDocument();
    });
});
