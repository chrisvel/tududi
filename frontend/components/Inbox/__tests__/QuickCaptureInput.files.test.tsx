import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { resetCaptureSettingsCache } from '../../../utils/captureSettings';
import {
    createInboxItemWithStore,
    analyzeInboxText,
    uploadInboxAttachment,
} from '../../../utils/inboxService';
import {
    ownerAttachmentsApi,
    uploadAttachment,
} from '../../../utils/attachmentsService';
import { createNote, updateNote } from '../../../utils/notesService';
import { createProject } from '../../../utils/projectsService';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (
            key: string,
            fallback?: string,
            values?: Record<string, string | number>
        ) =>
            (fallback || key).replace(/\{\{(\w+)\}\}/g, (_, name) =>
                String(values?.[name] ?? '')
            ),
    }),
}));

const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast,
    }),
}));

const createTaskInStore = jest.fn();
const updateInboxItem = jest.fn();
jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        tasksStore: {
            createTask: (task: unknown) => createTaskInStore(task),
            deleteTask: jest.fn(),
        },
        projectsStore: { setProjects: jest.fn() },
        inboxStore: {
            inboxItems: [{ uid: 'inbox-1', content: 'x', attachments: [] }],
            updateInboxItem: (item: unknown) => updateInboxItem(item),
        },
    };
    return {
        useStore: Object.assign(() => state, { getState: () => state }),
    };
});

jest.mock('../../../utils/tagsService', () => ({
    createTag: jest.fn(),
}));
jest.mock('../../../utils/notesService', () => ({
    createNote: jest.fn(),
    deleteNote: jest.fn(),
    updateNote: jest.fn(),
}));
jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
    deleteProject: jest.fn(),
    fetchProjects: jest.fn().mockResolvedValue([]),
}));

const ownerUpload = jest.fn();
jest.mock('../../../utils/configService', () => ({
    getServerConfig: jest.fn().mockResolvedValue({ fileUploadLimitMB: 1 }),
}));
jest.mock('../../../utils/attachmentsService', () => ({
    ...jest.requireActual('../../../utils/attachmentsService'),
    uploadAttachment: jest.fn(),
    ownerAttachmentsApi: jest.fn(() => ({
        upload: (file: File) => ownerUpload(file),
    })),
}));
jest.mock('../../../utils/inboxService', () => ({
    ...jest.requireActual('../../../utils/inboxService'),
    analyzeInboxText: jest.fn(),
    createInboxItemWithStore: jest.fn(),
    deleteInboxItemWithStore: jest.fn(),
    uploadInboxAttachment: jest.fn(),
}));

const screenshot = () => new File(['png'], 'image.png', { type: 'image/png' });

const clipboard = (files: File[], text = '') => ({
    files,
    types: files.length > 0 ? ['Files'] : ['text/plain'],
    getData: (type: string) => (type === 'text/plain' ? text : ''),
});

describe('QuickCaptureInput files', () => {
    const textarea = () => screen.getByTestId('quick-capture-input');
    const type = (value: string) =>
        fireEvent.change(textarea(), {
            target: { value, selectionStart: value.length },
        });
    const paste = async (files: File[], text = '') => {
        let event!: boolean;
        await act(async () => {
            event = fireEvent.paste(textarea(), {
                clipboardData: clipboard(files, text),
            });
        });
        return event;
    };
    const clickAdd = async () => {
        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-add'));
        });
    };
    const renderBox = () =>
        render(
            <MemoryRouter>
                <QuickCaptureInput unified projects={[]} />
            </MemoryRouter>
        );

    beforeEach(() => {
        localStorage.clear();
        resetCaptureSettingsCache();
        (window as any).matchMedia = undefined;
        (URL as any).createObjectURL = jest.fn(() => 'blob:preview');
        (URL as any).revokeObjectURL = jest.fn();
        showErrorToast.mockReset();
        updateInboxItem.mockReset();
        createTaskInStore.mockReset().mockResolvedValue({ uid: 'task-1' });
        (analyzeInboxText as jest.Mock).mockReset().mockResolvedValue(null);
        (createInboxItemWithStore as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'inbox-1' });
        (uploadInboxAttachment as jest.Mock)
            .mockReset()
            .mockImplementation(async (_uid: string, file: File) => ({
                uid: 'att-1',
                original_filename: file.name,
            }));
        (uploadAttachment as jest.Mock).mockReset().mockResolvedValue({});
        (createNote as jest.Mock).mockReset().mockResolvedValue({
            uid: 'note-1',
        });
        (updateNote as jest.Mock).mockReset().mockResolvedValue({});
        (createProject as jest.Mock).mockReset().mockResolvedValue({
            uid: 'project-1',
        });
        (ownerAttachmentsApi as jest.Mock).mockClear();
        let n = 0;
        ownerUpload.mockReset().mockImplementation(async (file: File) => {
            n += 1;
            return {
                uid: `att-${n}`,
                original_filename: file.name,
                mime_type: file.type,
                file_url: `/api/uploads/note-files/f-${n}`,
            };
        });
    });

    it('attaches a pasted screenshot and saves it to the Inbox on its own', async () => {
        renderBox();

        const notHandled = await paste([screenshot()]);

        expect(notHandled).toBe(false);
        const chip = screen.getByTestId('capture-file');
        expect(chip).toHaveTextContent(/^Pasted image \d{4}-\d{2}-\d{2}/);
        expect(screen.getByTestId('capture-add')).not.toBeDisabled();

        await clickAdd();

        const title = (createInboxItemWithStore as jest.Mock).mock
            .calls[0][0] as string;
        expect(title).toMatch(/^Pasted image /);
        expect(uploadInboxAttachment).toHaveBeenCalledWith(
            'inbox-1',
            expect.any(File)
        );
        expect(updateInboxItem).toHaveBeenCalledWith(
            expect.objectContaining({
                uid: 'inbox-1',
                attachments: [expect.objectContaining({ uid: 'att-1' })],
            })
        );
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            '1 files attached.'
        );
        expect(screen.queryByTestId('capture-file')).not.toBeInTheDocument();
    });

    it('pastes text, not the picture, when a copy carries both', async () => {
        renderBox();

        const notHandled = await paste([screenshot()], 'A1\tB1');

        expect(notHandled).toBe(true);
        expect(screen.queryByTestId('capture-file')).not.toBeInTheDocument();
    });

    it('saves files onto a note and places them in its text', async () => {
        renderBox();
        fireEvent.click(screen.getByTestId('capture-target-note'));
        await paste([
            screenshot(),
            new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' }),
        ]);
        type('Plumber\nCame on Monday');

        await clickAdd();

        expect(createNote).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Plumber',
                content: 'Came on Monday',
            })
        );
        expect(ownerUpload).toHaveBeenCalledTimes(2);
        expect(ownerAttachmentsApi).toHaveBeenCalledWith('note', 'note-1');
        const [uid, update] = (updateNote as jest.Mock).mock.calls[0];
        expect(uid).toBe('note-1');
        expect(update.content).toMatch(
            /^Came on Monday\n\n!\[Pasted image [^\]]+\]\(\/api\/uploads\/note-files\/f-1\)\n\n\[invoice\.pdf\]\(\/api\/note\/note-1\/attachments\/att-2\/download\)$/
        );
    });

    it('saves files onto a project', async () => {
        renderBox();
        fireEvent.click(screen.getByTestId('capture-target-project'));
        await paste([
            new File(['pdf'], 'brief.pdf', { type: 'application/pdf' }),
        ]);
        type('Garden');

        await clickAdd();

        expect(createProject).toHaveBeenCalled();
        expect(ownerAttachmentsApi).toHaveBeenCalledWith(
            'project',
            'project-1'
        );
        expect(ownerUpload).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'brief.pdf' })
        );
    });

    it('saves files onto a task', async () => {
        renderBox();
        fireEvent.click(screen.getByTestId('capture-target-task'));
        await paste([
            new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' }),
        ]);
        type('Pay the invoice');

        await clickAdd();

        expect(uploadAttachment).toHaveBeenCalledWith(
            'task-1',
            expect.objectContaining({ name: 'invoice.pdf' })
        );
    });

    it('names a file that could not be attached and keeps the item', async () => {
        (uploadInboxAttachment as jest.Mock).mockRejectedValue(
            new Error('nope')
        );
        renderBox();
        await paste([screenshot()]);
        type('Receipt');

        await clickAdd();

        expect(createInboxItemWithStore).toHaveBeenCalledWith('Receipt');
        expect(showErrorToast).toHaveBeenCalledWith(
            expect.stringMatching(/could not be attached: Pasted image/)
        );
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Saved "Receipt" to Inbox.'
        );
    });

    it('refuses a file over the upload limit', async () => {
        renderBox();
        const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.zip', {
            type: 'application/zip',
        });

        await paste([big]);

        expect(screen.queryByTestId('capture-file')).not.toBeInTheDocument();
        expect(showErrorToast).toHaveBeenCalledWith(
            'big.zip is larger than 1 MB, so it was not added.'
        );
    });

    it('takes files dropped on the field and lets one be removed', async () => {
        renderBox();
        const field = screen.getByTestId('capture-field');
        const files = [
            new File(['a'], 'a.txt', { type: 'text/plain' }),
            new File(['b'], 'b.txt', { type: 'text/plain' }),
        ];

        await act(async () => {
            fireEvent.drop(field, {
                dataTransfer: { files, types: ['Files'] },
            });
        });

        expect(screen.getAllByTestId('capture-file')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Remove a.txt' }));

        const left = screen.getAllByTestId('capture-file');
        expect(left).toHaveLength(1);
        expect(left[0]).toHaveTextContent('b.txt');
    });

    it('adds files chosen with the paperclip button', async () => {
        renderBox();
        const input = screen.getByTestId('capture-file-input');

        await act(async () => {
            fireEvent.change(input, {
                target: {
                    files: [
                        new File(['c'], 'notes.md', { type: 'text/markdown' }),
                    ],
                },
            });
        });

        expect(screen.getByTestId('capture-file')).toHaveTextContent(
            'notes.md'
        );
    });
});
