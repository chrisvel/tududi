import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
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

jest.mock('../components/Note/NoteModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../components/Note/NoteFocusMode', () => ({
    __esModule: true,
    default: () => null,
}));

import { updateNote, fetchNoteBySlug } from '../utils/notesService';

const mockUpdateNote = updateNote as jest.Mock;
const mockFetchNoteBySlug = fetchNoteBySlug as jest.Mock;

const noteA = {
    uid: 'note-a',
    title: 'Note A',
    content: 'Alpha',
    updated_at: '2026-01-01T00:00:00Z',
};
const noteB = {
    uid: 'note-b',
    title: 'Note B',
    content: 'Beta',
    updated_at: '2026-01-02T00:00:00Z',
};

let storeState: any;

jest.mock('../store/useStore', () => {
    const mockUseStore: any = (selector?: any) =>
        selector ? selector(storeState) : storeState;
    mockUseStore.getState = () => storeState;
    return { useStore: mockUseStore };
});

const renderNotesAt = (uid: string) =>
    render(
        <MemoryRouter initialEntries={[`/notes/${uid}`]}>
            <Link to="/notes/note-b">go to B</Link>
            <Routes>
                <Route path="/notes/:uid" element={<Notes />} />
            </Routes>
        </MemoryRouter>
    );

describe('Notes always-editable', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        storeState = {
            notesStore: {
                notes: [noteA, noteB],
                isLoading: false,
                isError: false,
                hasLoaded: true,
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
        mockUpdateNote.mockImplementation(async (uid: string, data: any) => ({
            ...data,
            uid,
        }));
        mockFetchNoteBySlug.mockResolvedValue(noteA);
    });

    it('opens a note straight into the editor without a click', async () => {
        renderNotesAt('note-a');

        expect(await screen.findByDisplayValue('Note A')).toBeInTheDocument();
        expect(screen.getByLabelText('markdown-editor')).toHaveValue('Alpha');
        // Opening must not write anything
        expect(mockUpdateNote).not.toHaveBeenCalled();
    });

    it('saves the note being left, then opens the next one in the editor', async () => {
        const user = userEvent.setup();
        renderNotesAt('note-a');

        const editor = await screen.findByLabelText('markdown-editor');
        await user.type(editor, '!');
        expect(editor).toHaveValue('Alpha!');

        await act(async () => {
            await user.click(screen.getByText('go to B'));
        });

        await waitFor(() => {
            expect(mockUpdateNote).toHaveBeenCalledWith(
                'note-a',
                expect.objectContaining({ content: 'Alpha!' })
            );
        });
        expect(await screen.findByDisplayValue('Note B')).toBeInTheDocument();
        expect(screen.getByLabelText('markdown-editor')).toHaveValue('Beta');
        expect(mockUpdateNote).not.toHaveBeenCalledWith(
            'note-b',
            expect.anything()
        );

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1100));
        });
    });
});
