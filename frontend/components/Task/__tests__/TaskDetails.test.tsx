import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetails from '../TaskDetails';

jest.mock('react-router-dom', () => ({
    useParams: () => ({ uid: 'task-1' }),
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/task/task-1', state: {} }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

// dateUtils imports the real i18n singleton (i18next.use(Backend)...) purely
// for its `language` field; stub it out so requiring TaskDetails doesn't
// spin up the real i18next/http-backend/language-detector chain.
jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../Shared/LoadingScreen', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-screen" />,
}));

jest.mock('../../Shared/ConfirmDialog', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../AI/TaskAIInsights', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../TaskTimeline', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
}));

jest.mock('../../../utils/attachmentsService', () => ({
    fetchAttachments: jest.fn().mockResolvedValue([]),
}));

const mockSubtaskInStore = {
    id: 2,
    uid: 'subtask-1',
    name: 'Subtask A',
    status: 'not_started',
    parent_task_id: 1,
};

const mockParentTaskInStore = {
    id: 1,
    uid: 'task-1',
    name: 'Parent Task',
    status: 'not_started',
    priority: 'medium',
    project_id: null,
    subtasks: [mockSubtaskInStore],
};

const mockUpdateTask = jest.fn();

jest.mock('../../../utils/tasksService', () => ({
    updateTask: (...args: any[]) => mockUpdateTask(...args),
    deleteTask: jest.fn(),
    // Deferred lookups (not `.mockResolvedValue(mockParentTaskInStore)`) so
    // this factory doesn't dereference the outer consts before they're
    // initialized - jest.mock factories run as soon as the mocked module is
    // first required, which happens before this file's own top-level code.
    fetchTaskByUid: jest.fn(() => Promise.resolve(mockParentTaskInStore)),
    fetchTaskNextIterations: jest.fn().mockResolvedValue([]),
    fetchSubtasks: jest.fn(() => Promise.resolve([mockSubtaskInStore])),
    toggleTaskCompletion: jest.fn(),
}));

// Stub every TaskDetails/ card except TaskSubtasksCard, which we render
// interactively so we can trigger the real handleSubtaskUpdate wiring from
// TaskDetails.tsx - the same path a user hits from the subtask status
// dropdown.
jest.mock('../TaskDetails/', () => ({
    TaskDetailsHeader: () => null,
    TaskContentCard: () => null,
    TaskProjectCard: () => null,
    TaskTagsCard: () => null,
    TaskSubtasksCard: ({ subtasks, onSubtaskUpdate }: any) => (
        <div>
            {subtasks.map((s: any) => (
                <button
                    key={s.uid}
                    onClick={() =>
                        onSubtaskUpdate({ ...s, status: 'in_progress' })
                    }
                >
                    Change status of {s.name}
                </button>
            ))}
        </div>
    ),
    TaskRecurrenceCard: () => null,
    TaskDueDateCard: () => null,
    TaskDeferUntilCard: () => null,
    TaskAttachmentsCard: () => null,
    TaskAreaCard: () => null,
    TaskAssignedToCard: () => null,
    TaskGoalCard: () => null,
}));

let mockTasksInStore: any[];
const mockSetTasks = jest.fn((updated: any[]) => {
    mockTasksInStore = updated;
});

jest.mock('../../../store/useStore', () => {
    const mockUseStore: any = (selector: any) =>
        selector({
            projectsStore: { projects: [] },
            tagsStore: {
                tags: [],
                hasLoaded: true,
                isLoading: false,
                loadTags: jest.fn(),
            },
            tasksStore: {
                get tasks() {
                    return mockTasksInStore;
                },
                setTasks: mockSetTasks,
            },
            areasStore: {
                areas: [],
                hasLoaded: true,
                isLoading: false,
                loadAreas: jest.fn(),
            },
            goalsStore: {
                goals: [],
                hasLoaded: true,
                isLoading: false,
                loadGoals: jest.fn(),
            },
            userSettingsStore: { aiAssistantEnabled: false },
        });
    mockUseStore.getState = () => ({
        tasksStore: { tasks: mockTasksInStore, setTasks: mockSetTasks },
    });
    return { useStore: mockUseStore };
});

describe('TaskDetails subtask status updates', () => {
    beforeEach(() => {
        mockTasksInStore = [
            {
                ...mockParentTaskInStore,
                subtasks: [{ ...mockSubtaskInStore }],
            },
        ];
        mockUpdateTask.mockReset();
        mockUpdateTask.mockResolvedValue({
            ...mockSubtaskInStore,
            status: 'in_progress',
        });
        mockSetTasks.mockClear();
    });

    it('persists a subtask status change via the API instead of only updating local state', async () => {
        render(<TaskDetails />);

        const button = await screen.findByText('Change status of Subtask A');
        fireEvent.click(button);

        // Regression guard for #1420: changing a subtask's status must PATCH
        // the backend, not just mutate the in-memory tasksStore - otherwise
        // the change is lost on refresh.
        await waitFor(() => {
            expect(mockUpdateTask).toHaveBeenCalledWith(
                'subtask-1',
                expect.objectContaining({ status: 'in_progress' })
            );
        });
    });

    it('reflects the server-saved subtask in the tasks store after the update', async () => {
        render(<TaskDetails />);

        const button = await screen.findByText('Change status of Subtask A');
        fireEvent.click(button);

        await waitFor(() => {
            const lastCall =
                mockSetTasks.mock.calls[mockSetTasks.mock.calls.length - 1];
            const updatedTasks = lastCall?.[0];
            const updatedParent = updatedTasks?.find(
                (t: any) => t.uid === 'task-1'
            );
            expect(updatedParent?.subtasks?.[0]?.status).toBe('in_progress');
        });
    });
});
