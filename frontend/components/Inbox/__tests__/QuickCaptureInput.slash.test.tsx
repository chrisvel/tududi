import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { resetCaptureSettingsCache } from '../../../utils/captureSettings';
import { analyzeInboxText } from '../../../utils/inboxService';
import { createProject, fetchProjects } from '../../../utils/projectsService';

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

const mockCreateTask = jest.fn();
const mockCreateArea = jest.fn();
jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [{ id: 1, name: 'urgent' }],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        tasksStore: {
            createTask: (task: unknown) => mockCreateTask(task),
            deleteTask: jest.fn(),
        },
        projectsStore: { setProjects: jest.fn() },
        areasStore: {
            areas: [
                { id: 7, uid: 'work', name: 'Work' },
                { id: 8, uid: 'home', name: 'Home Office' },
            ],
            setAreas: (areas: unknown[]) => {
                state.areasStore.areas = areas as typeof state.areasStore.areas;
            },
        },
        notesStore: { addNote: jest.fn() },
        userSettingsStore: { focus: null },
    };
    return {
        useStore: Object.assign(() => state, { getState: () => state }),
    };
});

jest.mock('../../../utils/areasService', () => ({
    createArea: (area: unknown) => mockCreateArea(area),
}));
jest.mock('../../../utils/tagsService', () => ({ createTag: jest.fn() }));
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

const KNOWN_AREAS: Record<string, string> = {
    work: 'work',
    'home office': 'home',
};

// Reads #tags, +projects and ~areas the way the server does
const analyze = (text: string) => {
    const quotedOrWord = (sigil: string) =>
        [
            ...text.matchAll(
                new RegExp(`(?:^|\\s)\\${sigil}(?:"([^"]+)"|(\\S+))`, 'g')
            ),
        ].map((m) => m[1] ?? m[2]);
    const area = quotedOrWord('~')[0];
    return Promise.resolve({
        parsed_tags: quotedOrWord('#'),
        parsed_projects: quotedOrWord('+'),
        parsed_due_date: null,
        parsed_date_text: null,
        parsed_recurrence: null,
        parsed_person: null,
        parsed_assignee: null,
        parsed_area: area
            ? { uid: KNOWN_AREAS[area.toLowerCase()] ?? null, name: area }
            : null,
        suggested_type: null,
        suggested_reason: null,
        cleaned_content: text
            .replace(/(^|\s)[#+~](?:"[^"]+"|\S+)/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
    });
};

const inMenu = () => within(screen.getByTestId('slash-menu'));

describe('QuickCaptureInput slash menu', () => {
    const input = () =>
        screen.getByTestId('quick-capture-input') as HTMLInputElement;
    const type = (value: string) =>
        fireEvent.change(input(), {
            target: { value, selectionStart: value.length },
        });
    const press = (key: string) => fireEvent.keyDown(input(), { key });
    const chooseTarget = (target: string) =>
        fireEvent.click(screen.getByTestId(`capture-target-${target}`));
    const clickAdd = async () => {
        await act(async () => {
            fireEvent.click(screen.getByTestId('capture-add'));
        });
    };

    beforeEach(() => {
        localStorage.clear();
        resetCaptureSettingsCache();
        Object.defineProperty(window, 'matchMedia', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        mockCreateTask.mockReset().mockResolvedValue({ uid: 'task-1' });
        mockCreateArea
            .mockReset()
            .mockImplementation(async (area: { name: string }) => ({
                id: 9,
                uid: 'new-area',
                name: area.name,
            }));
        (createProject as jest.Mock)
            .mockReset()
            .mockResolvedValue({ uid: 'new-project' });
        (fetchProjects as jest.Mock).mockReset().mockResolvedValue([]);
        (analyzeInboxText as jest.Mock)
            .mockReset()
            .mockImplementation((text: string) => analyze(text));
        render(
            <MemoryRouter>
                <QuickCaptureInput
                    unified
                    projects={[{ id: 1, uid: 'launch', name: 'Launch' }]}
                />
            </MemoryRouter>
        );
        chooseTarget('task');
    });

    it('lists the tokens for a task when "/" starts a word', () => {
        type('Plan offsite /');

        ['Tag', 'Project', 'Person', 'Area', 'Due date', 'Repeat'].forEach(
            (label) => expect(inMenu().getByText(label)).toBeInTheDocument()
        );
    });

    it('does not open inside a URL', () => {
        type('see https://example.com/');

        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    });

    it('keeps a picked area as a badge, not as text', () => {
        type('Plan offsite /');
        fireEvent.click(inMenu().getByText('Area'));

        expect(input().value).toBe('Plan offsite /');
        fireEvent.click(inMenu().getByText('Home Office'));

        expect(input().value.trim()).toBe('Plan offsite');
        expect(screen.getByTestId('selected-area')).toHaveTextContent(
            'Home Office'
        );
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    });

    it('lists the areas as soon as "~" is typed and narrows them', () => {
        type('Plan offsite ~');

        expect(inMenu().getByText('Work')).toBeInTheDocument();
        expect(inMenu().getByText('Home Office')).toBeInTheDocument();

        type('Plan offsite ~hom');
        expect(inMenu().queryByText('Work')).not.toBeInTheDocument();
        fireEvent.click(inMenu().getByText('Home Office'));

        expect(input().value.trim()).toBe('Plan offsite');
        expect(screen.getByTestId('selected-area')).toBeInTheDocument();
    });

    it('lists nothing for a "~" that matches no area, and in a note', () => {
        type('Walk ~5');
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();

        chooseTarget('note');
        type('Ideas ~');
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    });

    it('narrows a list by typing and picks a project with Enter', () => {
        type('Fix /');
        fireEvent.click(inMenu().getByText('Project'));
        type('Fix /lau');

        expect(inMenu().getByText('Launch')).toBeInTheDocument();
        act(() => {
            press('Enter');
        });

        expect(input().value.trim()).toBe('Fix');
        expect(
            screen.getByTestId('selected-project-Launch')
        ).toBeInTheDocument();
    });

    it('keeps a tag picked from the # list as a badge', () => {
        type('Fix #ur');
        fireEvent.click(screen.getByText('#urgent'));

        expect(input().value.trim()).toBe('Fix');
        expect(screen.getByTestId('selected-tag-urgent')).toBeInTheDocument();
    });

    it('removes a picked badge with its X', () => {
        type('Plan /');
        fireEvent.click(inMenu().getByText('Area'));
        fireEvent.click(inMenu().getByText('Work'));

        fireEvent.click(
            within(screen.getByTestId('selected-area')).getByTitle(
                'Remove area'
            )
        );

        expect(screen.queryByTestId('selected-area')).not.toBeInTheDocument();
    });

    it('saves the badges with the item and clears them', async () => {
        type('Fix tap');
        type('Fix tap #ur');
        fireEvent.click(screen.getByText('#urgent'));
        type('Fix tap /');
        fireEvent.click(inMenu().getByText('Project'));
        fireEvent.click(inMenu().getByText('Launch'));
        type('Fix tap /');
        fireEvent.click(inMenu().getByText('Area'));
        fireEvent.click(inMenu().getByText('Home Office'));
        await clickAdd();

        expect(mockCreateTask).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Fix tap',
                project_uid: 'launch',
                area_id: 8,
                tags: [expect.objectContaining({ name: 'urgent' })],
            })
        );
        expect(screen.queryByTestId('selected-area')).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('selected-tag-urgent')
        ).not.toBeInTheDocument();
    });

    it('creates an unknown ~Name typed in the text and strips it from the title', async () => {
        type('#admin #kids +"Monday slides prep" ~Career hi ');
        await clickAdd();

        expect(mockCreateArea).toHaveBeenCalledWith({ name: 'Career' });
        expect(mockCreateTask).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'hi', area_id: 9 })
        );
    });

    it('closes on Escape and keeps the text', () => {
        type('Fix /pro');
        press('Escape');

        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
        expect(input().value).toBe('Fix /pro');
    });

    it('only offers tag and project for a note', () => {
        chooseTarget('note');
        type('Ideas /');

        expect(inMenu().getByText('Tag')).toBeInTheDocument();
        expect(inMenu().queryByText('Area')).not.toBeInTheDocument();
        expect(inMenu().queryByText('Due date')).not.toBeInTheDocument();
    });
});
