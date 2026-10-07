import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, render } from '@testing-library/react';
import MarkdownEditor from '../MarkdownEditor';
import { ownerAttachmentsApi } from '../../../utils/attachmentsService';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast, showSuccessToast: jest.fn() }),
}));

jest.mock('../../../store/useStore', () => {
    const state = {
        notesStore: { notes: [], hasLoaded: true, loadNotes: jest.fn() },
    };
    return {
        useStore: (selector: (s: typeof state) => unknown) => selector(state),
    };
});

const upload = jest.fn();
jest.mock('../../../utils/attachmentsService', () => ({
    ...jest.requireActual('../../../utils/attachmentsService'),
    ownerAttachmentsApi: jest.fn(() => ({ upload })),
}));

const pasteFiles = (content: Element, files: File[]) => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
        value: {
            files,
            types: ['Files'],
            getData: () => '',
        },
    });
    content.dispatchEvent(event);
    return event;
};

describe('MarkdownEditor files', () => {
    const renderEditor = (noteUid?: string) => {
        const onChange = jest.fn();
        const view = render(
            <MemoryRouter>
                <MarkdownEditor
                    value="Garden plan"
                    onChange={onChange}
                    noteUid={noteUid}
                />
            </MemoryRouter>
        );
        const content = view.container.querySelector('.cm-content');
        if (!content) throw new Error('editor did not mount');
        return { onChange, content };
    };

    beforeEach(() => {
        showErrorToast.mockReset();
        upload.mockReset();
        (ownerAttachmentsApi as jest.Mock).mockClear();
    });

    it('uploads a pasted image and places it in the text', async () => {
        upload.mockResolvedValue({
            uid: 'att-1',
            original_filename: 'plan.png',
            mime_type: 'image/png',
            file_url: '/api/uploads/note-files/note-1.png',
        });
        const { onChange, content } = renderEditor('note-uid');

        let event!: Event;
        await act(async () => {
            event = pasteFiles(content, [
                new File(['png'], 'plan.png', { type: 'image/png' }),
            ]);
        });

        expect(event.defaultPrevented).toBe(true);
        expect(ownerAttachmentsApi).toHaveBeenCalledWith('note', 'note-uid');
        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(last).toContain(
            '![plan.png](/api/uploads/note-files/note-1.png)'
        );
        expect(last).not.toContain('Uploading');
    });

    it('links a pasted file that is not an image', async () => {
        upload.mockResolvedValue({
            uid: 'att-2',
            original_filename: 'brief.pdf',
            mime_type: 'application/pdf',
            file_url: '/api/uploads/note-files/note-2.pdf',
        });
        const { onChange, content } = renderEditor('note-uid');

        await act(async () => {
            pasteFiles(content, [
                new File(['pdf'], 'brief.pdf', { type: 'application/pdf' }),
            ]);
        });

        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(last).toContain(
            '[brief.pdf](/api/note/note-uid/attachments/att-2/download)'
        );
    });

    it('removes the placeholder and says so when an upload fails', async () => {
        upload.mockRejectedValue(new Error('Too big'));
        const { onChange, content } = renderEditor('note-uid');

        await act(async () => {
            pasteFiles(content, [
                new File(['pdf'], 'brief.pdf', { type: 'application/pdf' }),
            ]);
        });

        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(last).not.toContain('Uploading');
        expect(showErrorToast).toHaveBeenCalledWith('brief.pdf: Too big');
    });

    it('asks for the note to be saved before taking files', async () => {
        const { content } = renderEditor(undefined);

        await act(async () => {
            pasteFiles(content, [
                new File(['png'], 'plan.png', { type: 'image/png' }),
            ]);
        });

        expect(upload).not.toHaveBeenCalled();
        expect(showErrorToast).toHaveBeenCalledWith(
            'Give the note a title or some text first, then add files.'
        );
    });
});
