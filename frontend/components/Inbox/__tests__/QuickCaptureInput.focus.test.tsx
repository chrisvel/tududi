import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { resetCaptureSettingsCache } from '../../../utils/captureSettings';
import { createNote } from '../../../utils/notesService';
import { createProject, fetchProjects } from '../../../utils/projectsService';
import { analyzeInboxText } from '../../../utils/inboxService';

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

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

const createTaskInStore = jest.fn();
// The focus is swapped per test through this holder; the store mock reads
// it lazily so jest's hoisting of the factory does not matter
const mockFocusHolder: { focus: unknown } = { focus: null };
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
        areasStore: { areas: [{ id: 7, uid: 'work', name: 'Work' }] },
        notesStore: { addNote: jest.fn() },
        userSettingsStore: {
            get focus() {
                return mockFocusHolder.focus;
            },
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

const analyze = (text: string) =>
    Promise.resolve({
        parsed_tags: (text.match(/#[\w-]+/g) ?? []).map((tag) => tag.slice(1)),
        parsed_projects: (text.match(/\+\w+/g) ?? []).map((p) => p.slice(1)),
        parsed_due_date: null,
        parsed_date_text: null,
        parsed_recurrence: null,
        parsed_person: null,
        parsed_assignee: null,
        suggested_type: null,
        suggested_reason: null,
        cleaned_content: text
            .replace(/#[\w-]+/g, '')
            .replace(/\+\w+/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
    });

describe('QuickCaptureInput with a Focus', () => {
    const type = (value: string) =>
        fireEvent.change(screen.getByTestId('quick-capture-input'), {
            target: { value, selectionStart: value.length },
        });
    const chooseTarget = (target: string) =>
        fireEvent.click(screen.getByTestId(`capture-target-${target}`));
    const clickAdd = async () => {
        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-add'));
        });
    };
    const renderBox = () =>
        render(
            <MemoryRouter>
                <QuickCaptureInput
                    unified
                    projects={[
                        { id: 1, uid: 'launch', name: 'Launch' },
                        { id: 2, uid: 'garden', name: 'Garden' },
                    ]}
                />
            </MemoryRouter>
        );

    beforeEach(() => {
        localStorage.clear();
        resetCaptureSettingsCache();
        (window as any).matchMedia = undefined;
        mockFocusHolder.focus = {
            area_uid: 'work',
            project_uid: 'launch',
            tags: ['urgent'],
        };
        createTaskInStore.mockReset().mockResolvedValue({ uid: 'task-1' });
        (analyzeInboxText as jest.Mock)
            .mockReset()
            .mockImplementation((text: string) => analyze(text));
        (createNote as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'note-1' });
        (createProject as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'project-1' });
        (fetchProjects as jest.Mock).mockReset().mockResolvedValue([]);
    });

    it('gives a task the focus project and tags when the text names none', async () => {
        renderBox();
        chooseTarget('task');
        type('Write the brief #draft');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Write the brief',
                project_uid: 'launch',
                tags: [{ name: 'draft' }, { name: 'urgent' }],
            })
        );
    });

    it('lets a +project in the text win over the focus project', async () => {
        renderBox();
        chooseTarget('task');
        type('Water plants +Garden');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({ project_uid: 'garden' })
        );
    });

    it('gives a note the focus project but not the focus tags', async () => {
        renderBox();
        chooseTarget('note');
        type('Kickoff notes');
        await clickAdd();

        expect(createNote).toHaveBeenCalledWith(
            expect.objectContaining({ project_uid: 'launch', tags: [] })
        );
    });

    it('puts a new project in the focus area', async () => {
        renderBox();
        chooseTarget('project');
        type('Website refresh');
        await clickAdd();

        expect(createProject).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Website refresh', area_id: 7 })
        );
    });

    it('changes nothing without a focus', async () => {
        mockFocusHolder.focus = null;
        renderBox();
        chooseTarget('task');
        type('Plain task');
        await clickAdd();

        expect(createTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({ project_uid: undefined, tags: [] })
        );
    });
});
