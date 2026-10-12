import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { resetCaptureSettingsCache } from '../../../utils/captureSettings';
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

jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [{ id: 1, name: 'urgent' }],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        tasksStore: { createTask: jest.fn(), deleteTask: jest.fn() },
        projectsStore: { setProjects: jest.fn() },
        areasStore: {
            areas: [
                { id: 7, uid: 'work', name: 'Work' },
                { id: 8, uid: 'home', name: 'Home Office' },
            ],
        },
        notesStore: { addNote: jest.fn() },
        userSettingsStore: { focus: null },
    };
    return {
        useStore: Object.assign(() => state, { getState: () => state }),
    };
});

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

    beforeEach(() => {
        localStorage.clear();
        resetCaptureSettingsCache();
        Object.defineProperty(window, 'matchMedia', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        (analyzeInboxText as jest.Mock).mockReset().mockResolvedValue({
            parsed_tags: [],
            parsed_projects: [],
            parsed_due_date: null,
            parsed_date_text: null,
            parsed_recurrence: null,
            parsed_person: null,
            parsed_assignee: null,
            parsed_area: null,
            suggested_type: null,
            suggested_reason: null,
            cleaned_content: '',
        });
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

    it('opens the area list and inserts the chosen area, quoted', () => {
        type('Plan offsite /');
        fireEvent.click(inMenu().getByText('Area'));

        expect(input().value).toBe('Plan offsite /');
        fireEvent.click(inMenu().getByText('Home Office'));

        expect(input().value).toBe('Plan offsite ~"Home Office" ');
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    });

    it('lists the areas as soon as "~" is typed and narrows them', () => {
        type('Plan offsite ~');

        expect(inMenu().getByText('Work')).toBeInTheDocument();
        expect(inMenu().getByText('Home Office')).toBeInTheDocument();

        type('Plan offsite ~hom');
        expect(inMenu().queryByText('Work')).not.toBeInTheDocument();
        fireEvent.click(inMenu().getByText('Home Office'));

        expect(input().value).toBe('Plan offsite ~"Home Office" ');
    });

    it('lists nothing for a "~" that matches no area, and in a note', () => {
        type('Walk ~5');
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();

        chooseTarget('note');
        type('Ideas ~');
        expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    });

    it('narrows a list by typing and picks with Enter', () => {
        type('Fix /');
        fireEvent.click(inMenu().getByText('Project'));
        type('Fix /lau');

        expect(inMenu().getByText('Launch')).toBeInTheDocument();
        act(() => {
            press('Enter');
        });

        expect(input().value).toBe('Fix +Launch ');
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
