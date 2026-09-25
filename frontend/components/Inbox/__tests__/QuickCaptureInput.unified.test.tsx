import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import {
    resetCaptureSettingsCache,
    updateCaptureSettings,
} from '../../../utils/captureSettings';
import { createNote, deleteNote } from '../../../utils/notesService';
import {
    createProject,
    deleteProject,
    fetchProjects,
} from '../../../utils/projectsService';
import {
    createInboxItemWithStore,
    deleteInboxItemWithStore,
    analyzeInboxText,
} from '../../../utils/inboxService';

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
const deleteTaskInStore = jest.fn();
const setProjects = jest.fn();
jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        tasksStore: {
            createTask: (task: unknown) => createTaskInStore(task),
            deleteTask: (uid: string) => deleteTaskInStore(uid),
        },
        projectsStore: {
            setProjects: (list: unknown) => setProjects(list),
        },
    };
    return {
        useStore: Object.assign(() => state, { getState: () => state }),
    };
});

jest.mock('../../../utils/tagsService', () => ({
    createTag: jest.fn(async (tag: { name: string }) => ({ id: 99, ...tag })),
}));
jest.mock('../../../utils/notesService', () => ({
    createNote: jest.fn(),
    deleteNote: jest.fn(),
}));
jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
    deleteProject: jest.fn(),
    fetchProjects: jest.fn(),
}));
jest.mock('../../../utils/inboxService', () => ({
    ...jest.requireActual('../../../utils/inboxService'),
    analyzeInboxText: jest.fn(),
    createInboxItemWithStore: jest.fn(),
    deleteInboxItemWithStore: jest.fn(),
}));

const analyze = (text: string) => {
    const hasDate = /\btomorrow\b/.test(text);
    return Promise.resolve({
        parsed_tags: (text.match(/#[\w-]+/g) ?? []).map((tag) => tag.slice(1)),
        parsed_projects: (text.match(/\+\w+/g) ?? []).map((p) => p.slice(1)),
        parsed_due_date: hasDate ? '2026-09-26' : null,
        parsed_date_text: hasDate ? 'tomorrow' : null,
        parsed_recurrence: null,
        parsed_person: null,
        parsed_assignee: null,
        suggested_type: null,
        suggested_reason: null,
        cleaned_content: text
            .replace(/#[\w-]+/g, '')
            .replace(/\+\w+/g, '')
            .replace(/\btomorrow\b/, '')
            .replace(/\s+/g, ' ')
            .trim(),
    });
};

describe('QuickCaptureInput unified capture', () => {
    const textarea = () => screen.getByTestId('quick-capture-input');
    const type = (value: string) =>
        fireEvent.change(textarea(), {
            target: { value, selectionStart: value.length },
        });
    const chooseTarget = (target: string) =>
        fireEvent.click(screen.getByTestId(`capture-target-${target}`));
    const clickAdd = async () => {
        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-add'));
        });
    };
    const renderBox = (props: Record<string, unknown> = {}) =>
        render(
            <MemoryRouter>
                <QuickCaptureInput
                    unified
                    projects={[{ id: 1, uid: 'proj-uid', name: 'Website' }]}
                    {...props}
                />
            </MemoryRouter>
        );

    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        resetCaptureSettingsCache();
        (window as any).matchMedia = undefined;
        showErrorToast.mockReset();
        createTaskInStore.mockReset().mockResolvedValue({ uid: 'task-1' });
        deleteTaskInStore.mockReset().mockResolvedValue(undefined);
        setProjects.mockReset();
        (analyzeInboxText as jest.Mock)
            .mockReset()
            .mockImplementation((text: string) => analyze(text));
        (createInboxItemWithStore as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'inbox-1' });
        (deleteInboxItemWithStore as jest.Mock)
            .mockReset()
            .mockResolvedValue(undefined);
        (createNote as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'note-1' });
        (deleteNote as jest.Mock).mockReset().mockResolvedValue(undefined);
        (createProject as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'project-1' });
        (deleteProject as jest.Mock).mockReset().mockResolvedValue(undefined);
        (fetchProjects as jest.Mock).mockReset().mockResolvedValue([]);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('adds to the Inbox by default and offers Undo', async () => {
        renderBox();
        expect(screen.getByTestId('capture-target-inbox')).toHaveAttribute(
            'aria-checked',
            'true'
        );

        type('buy milk');
        await clickAdd();

        expect(createInboxItemWithStore).toHaveBeenCalledWith('buy milk');
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Saved "buy milk" to Inbox.'
        );
        expect(textarea()).toHaveValue('');

        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-undo'));
        });
        expect(deleteInboxItemWithStore).toHaveBeenCalledWith('inbox-1');
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Removed. Nothing was saved.'
        );
    });

    it('replaces the status line with the hint as soon as you type again', async () => {
        renderBox();
        type('one');
        await clickAdd();
        expect(screen.getByTestId('capture-status')).toHaveTextContent('Saved');

        type('t');
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Enter saves. Shift+Enter starts a new line.'
        );
    });

    it('reads the date, tags and project for a task', async () => {
        renderBox();
        chooseTarget('task');
        type('Call Sam tomorrow #errands +Website');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledTimes(1);
        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Call Sam',
                due_date: '2026-09-26',
                project_uid: 'proj-uid',
                tags: [{ name: 'errands' }],
            })
        );
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Created task "Call Sam".'
        );
    });

    it('makes the first line the title and the other lines the notes', async () => {
        renderBox();
        chooseTarget('task');
        type('Plan trip\nbook train\npack bags');
        expect(screen.getByTestId('capture-multiline')).toHaveTextContent(
            'This will be 1 task. The first line is the title and the other 2 lines are its notes.'
        );
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledTimes(1);
        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Plan trip',
                note: 'book train\npack bags',
            })
        );
    });

    it('only reads a date from the first line', async () => {
        renderBox();
        chooseTarget('task');
        type('Write report\nsend it tomorrow');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.not.objectContaining({ due_date: expect.anything() })
        );
    });

    it('makes one item per line when the notice link is used', async () => {
        renderBox();
        chooseTarget('task');
        type('- call the bank\n- buy milk tomorrow\n- print pass');
        fireEvent.click(screen.getByTestId('capture-multiline-toggle'));

        expect(screen.getByTestId('capture-multiline')).toHaveTextContent(
            'This will be 3 tasks, one per line.'
        );
        expect(screen.getByTestId('capture-add')).toHaveTextContent('Add 3');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledTimes(3);
        expect(createTaskInStore.mock.calls.map(([task]) => task.name)).toEqual(
            ['call the bank', 'buy milk', 'print pass']
        );
        expect(createTaskInStore.mock.calls[1][0].due_date).toBe('2026-09-26');
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Created 3 tasks.'
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-undo'));
        });
        expect(deleteTaskInStore).toHaveBeenCalledTimes(3);
    });

    it('keeps unsaved lines when a later line fails, so a retry does not duplicate', async () => {
        updateCaptureSettings({ oneItemPerLine: true });
        createTaskInStore
            .mockResolvedValueOnce({ uid: 'task-1' })
            .mockRejectedValueOnce(new Error('boom'));
        jest.spyOn(console, 'error').mockImplementation(() => {});
        renderBox();
        chooseTarget('task');
        type('first\nsecond\nthird');
        await clickAdd();

        expect(textarea()).toHaveValue('second\nthird');
        expect(showErrorToast).toHaveBeenCalled();
        expect(screen.getByTestId('capture-status')).toHaveTextContent(
            'Created task "first".'
        );
    });

    it('creates a note with the first line as its title and keeps its date words', async () => {
        renderBox();
        chooseTarget('note');
        type('Idea for tomorrow #writing\nmore detail here');
        await clickAdd();

        expect(createNote).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Idea for tomorrow',
                content: 'more detail here',
                tags: [{ name: 'writing' }],
            })
        );
    });

    it('creates a project with a due date and refreshes the project list', async () => {
        renderBox();
        chooseTarget('project');
        type('New site tomorrow');
        await clickAdd();

        expect(createProject).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'New site',
                status: 'planned',
                due_date_at: '2026-09-26',
            })
        );
        expect(fetchProjects).toHaveBeenCalled();
        expect(setProjects).toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-undo'));
        });
        expect(deleteProject).toHaveBeenCalledWith('project-1');
    });

    it('creates a missing +project for a task and links it', async () => {
        renderBox();
        chooseTarget('task');
        type('Draft brief +Launch');
        await clickAdd();

        expect(createProject).toHaveBeenCalledWith({
            name: 'Launch',
            status: 'planned',
        });
        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({ project_uid: 'project-1' })
        );
    });

    it('returns to the default target when it is opened again', () => {
        const { rerender } = renderBox({ defaultTarget: 'task', resetKey: 1 });
        expect(screen.getByTestId('capture-target-task')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        chooseTarget('note');
        expect(screen.getByTestId('capture-target-note')).toHaveAttribute(
            'aria-checked',
            'true'
        );

        rerender(
            <MemoryRouter>
                <QuickCaptureInput
                    unified
                    projects={[]}
                    defaultTarget="task"
                    resetKey={2}
                />
            </MemoryRouter>
        );
        expect(screen.getByTestId('capture-target-task')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    describe('Enter key', () => {
        it('saves on Enter and starts a new line on Shift+Enter with a keyboard', async () => {
            renderBox();
            type('write it');

            const shiftEnter = fireEvent.keyDown(textarea(), {
                key: 'Enter',
                shiftKey: true,
            });
            expect(shiftEnter).toBe(true);
            expect(createInboxItemWithStore).not.toHaveBeenCalled();

            await act(async () => {
                fireEvent.keyDown(textarea(), { key: 'Enter' });
            });
            expect(createInboxItemWithStore).toHaveBeenCalledWith('write it');
        });

        it('starts a new line on Enter on a touch device, and saves with Ctrl+Enter', async () => {
            (window as any).matchMedia = jest.fn(() => ({ matches: true }));
            renderBox();
            type('write it');

            const enter = fireEvent.keyDown(textarea(), { key: 'Enter' });
            expect(enter).toBe(true);
            expect(createInboxItemWithStore).not.toHaveBeenCalled();
            expect(screen.getByTestId('capture-status')).toHaveTextContent(
                'Return starts a new line.'
            );

            await act(async () => {
                fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
            });
            expect(createInboxItemWithStore).toHaveBeenCalledWith('write it');
        });

        it('follows the saved Enter setting', async () => {
            updateCaptureSettings({ enterKeyboard: 'newline' });
            renderBox();
            type('write it');

            const enter = fireEvent.keyDown(textarea(), { key: 'Enter' });
            expect(enter).toBe(true);
            expect(createInboxItemWithStore).not.toHaveBeenCalled();
            expect(screen.getByTestId('capture-status')).toHaveTextContent(
                'Enter starts a new line. Ctrl+Enter saves.'
            );
        });
    });

    it('closes on Escape when it has a close handler', () => {
        const onClose = jest.fn();
        renderBox({ onClose });
        fireEvent.keyDown(textarea(), { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('capture-close'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('tells the caller what was captured', async () => {
        const onCaptured = jest.fn();
        renderBox({ onCaptured });
        type('remember this');
        await clickAdd();

        expect(onCaptured).toHaveBeenCalledWith([
            { target: 'inbox', uid: 'inbox-1', title: 'remember this' },
        ]);
    });
});
