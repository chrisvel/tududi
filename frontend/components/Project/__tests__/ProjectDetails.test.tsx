import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectDetails from '../ProjectDetails';
import { fetchProjectBySlug } from '../../../utils/projectsService';

jest.mock('react-router-dom', () => ({
    useParams: () => ({ uidSlug: 'project-slug-123' }),
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/projects/project-slug-123', state: {} }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, optionsOrDefault?: any, maybeOptions?: any) => {
            const options =
                typeof optionsOrDefault === 'object' &&
                optionsOrDefault !== null
                    ? optionsOrDefault
                    : maybeOptions;

            let template = key;
            if (key === 'modals.deleteProject.message') {
                template =
                    'Czy na pewno chcesz usunąć projekt "{{projectName}}"?';
            } else if (typeof optionsOrDefault === 'string') {
                template = optionsOrDefault;
            } else if (options && typeof options.defaultValue === 'string') {
                template = options.defaultValue;
            }

            if (options && typeof options === 'object') {
                return template.replace(/\{\{(\w+)\}\}/g, (_, varName) =>
                    options[varName] !== undefined
                        ? String(options[varName])
                        : `{{${varName}}}`
                );
            }
            return template;
        },
        i18n: { language: 'pl' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'pl' },
}));

jest.mock('../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../Note/NoteModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../ProjectModal', () => ({
    __esModule: true,
    default: () => null,
}));

const mockStoreState = {
    areasStore: {
        areas: [],
        hasLoaded: true,
        isLoading: false,
        loadAreas: jest.fn(),
    },
    projectsStore: {
        projects: [],
        setProjects: jest.fn(),
    },
    userSettingsStore: {
        templatesEnabled: false,
    },
    notesStore: {
        notes: [],
        setNotes: jest.fn(),
    },
    tagsStore: {
        tags: [],
        hasLoaded: true,
        isLoading: false,
        loadTags: jest.fn(),
        addNewTags: jest.fn(),
        getTags: jest.fn().mockReturnValue([]),
    },
};

jest.mock('../../../store/useStore', () => ({
    useStore: Object.assign(() => mockStoreState, {
        getState: () => mockStoreState,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/projectsService', () => ({
    fetchProjectBySlug: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    fetchProjects: jest.fn().mockResolvedValue([]),
    saveProjectAsTemplate: jest.fn(),
}));

jest.mock('../../../utils/tasksService', () => ({
    fetchTaskOrder: jest.fn().mockResolvedValue([]),
    createTask: jest.fn(),
    deleteTask: jest.fn(),
    saveTaskOrder: jest.fn(),
}));

jest.mock('../../../utils/notesService', () => ({
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
    createNote: jest.fn(),
}));

jest.mock('../../../utils/goalsService', () => ({
    fetchGoals: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../AI/ProjectAIInsights', () => {
    const MockAI = React.forwardRef(() => null);
    MockAI.displayName = 'MockProjectAIInsights';
    return {
        __esModule: true,
        default: MockAI,
    };
});

jest.mock('../ProjectInsightsPanel', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../ProjectTasksSection', () => ({
    __esModule: true,
    default: () => null,
}));

describe('ProjectDetails delete confirmation (#1826)', () => {
    it('interpolates project name in delete confirm dialog and does not display literal placeholder', async () => {
        const testProject = {
            id: 99,
            uid: 'proj-99',
            name: 'Apollo Moon Mission',
            description: '',
            status: 'in_progress',
            tasks: [],
            notes: [],
        };
        (fetchProjectBySlug as jest.Mock).mockResolvedValue(testProject);

        render(<ProjectDetails />);

        await waitFor(() => {
            expect(screen.getByText('Apollo Moon Mission')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle('More options'));
        fireEvent.click(screen.getByText('Delete'));

        expect(
            screen.getByText(
                'Czy na pewno chcesz usunąć projekt "Apollo Moon Mission"?'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/\{\{projectName\}\}/)
        ).not.toBeInTheDocument();
    });
});
