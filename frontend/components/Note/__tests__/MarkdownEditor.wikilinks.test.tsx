import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import MarkdownEditor from '../MarkdownEditor';
import { createNote } from '../../../utils/notesService';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback: string, options?: Record<string, string>) =>
            fallback.replace(/\{\{(\w+)\}\}/g, (_m, k) => options?.[k] ?? ''),
    }),
}));

const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast, showSuccessToast: jest.fn() }),
}));

const addNote = jest.fn();
jest.mock('../../../store/useStore', () => {
    const state = {
        notesStore: {
            notes: [{ uid: 'n-1', title: 'Groceries', content: '' }],
            hasLoaded: true,
            loadNotes: jest.fn(),
            addNote: (...args: unknown[]) => addNote(...args),
        },
    };
    return {
        useStore: (selector: (s: typeof state) => unknown) => selector(state),
    };
});

jest.mock('../../../utils/notesService', () => ({
    createNote: jest.fn(),
}));

const typeText = (view: EditorView, text: string) => {
    for (const ch of text) {
        const pos = view.state.selection.main.head;
        act(() => {
            view.dispatch({
                changes: { from: pos, insert: ch },
                selection: { anchor: pos + ch.length },
                userEvent: 'input.type',
            });
        });
    }
};

describe('MarkdownEditor linked notes', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    const renderEditor = () => {
        const onChange = jest.fn();
        const { container } = render(
            <MemoryRouter>
                <MarkdownEditor value="" onChange={onChange} />
            </MemoryRouter>
        );
        const content = container.querySelector('.cm-content');
        const view = content && EditorView.findFromDOM(content as HTMLElement);
        if (!view) throw new Error('editor did not mount');
        view.coordsAtPos = () => ({ left: 10, right: 10, top: 10, bottom: 20 });
        return { view, onChange };
    };

    beforeEach(() => {
        addNote.mockReset();
        showErrorToast.mockReset();
        (createNote as jest.Mock).mockReset();
    });

    it('asks to create the note when a typed link points nowhere', async () => {
        (createNote as jest.Mock).mockResolvedValue({
            uid: 'n-2',
            title: 'Packing list',
            content: '',
        });
        const { view } = renderEditor();

        typeText(view, '[[Packing list]]');

        expect(
            screen.getByText('No note called "Packing list" yet. Create it?')
        ).toBeInTheDocument();

        await act(async () => {
            fireEvent.mouseDown(screen.getByText('Create note'));
        });

        expect(createNote).toHaveBeenCalledWith({
            title: 'Packing list',
            content: '',
        });
        expect(addNote).toHaveBeenCalledWith(
            expect.objectContaining({ uid: 'n-2' })
        );
        expect(screen.queryByTestId('missing-note-prompt')).toBeNull();
    });

    it('does not ask when the linked note exists', () => {
        const { view } = renderEditor();

        typeText(view, '[[groceries]]');

        expect(screen.queryByTestId('missing-note-prompt')).toBeNull();
    });

    it('dismisses the prompt with Escape without creating anything', () => {
        const { view } = renderEditor();

        typeText(view, '[[Packing list]]');
        act(() => {
            fireEvent.keyDown(window, { key: 'Escape' });
        });

        expect(screen.queryByTestId('missing-note-prompt')).toBeNull();
        expect(createNote).not.toHaveBeenCalled();
    });

    it('offers to create a note from the link menu', async () => {
        (createNote as jest.Mock).mockResolvedValue({
            uid: 'n-3',
            title: 'Trip',
            content: '',
        });
        const { view, onChange } = renderEditor();

        typeText(view, '[[Trip');
        await act(async () => {
            fireEvent.mouseDown(screen.getByTestId('wikilink-create-note'));
        });

        expect(createNote).toHaveBeenCalledWith({ title: 'Trip', content: '' });
        expect(onChange).toHaveBeenLastCalledWith('[[Trip]]');
    });

    it('says so when the note cannot be created', async () => {
        (createNote as jest.Mock).mockRejectedValue(new Error('nope'));
        const { view } = renderEditor();

        typeText(view, '[[Packing list]]');
        await act(async () => {
            fireEvent.mouseDown(screen.getByText('Create note'));
        });

        expect(showErrorToast).toHaveBeenCalledWith(
            'Could not create the note.'
        );
    });
});
