import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskModal from '../TaskModal';
import { updateTask, fetchTaskByUid } from '../../../utils/tasksService';
import { analyzeInboxText } from '../../../utils/inboxService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../Inbox/QuickCaptureInput', () => ({
    __esModule: true,
    default: ({ initialValue, onTextChange }: any) => (
        <input
            data-testid="task-name-input"
            defaultValue={initialValue}
            key={initialValue}
            onChange={(e) => onTextChange(e.target.value)}
        />
    ),
}));

jest.mock('../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({ content }: any) => (
        <div data-testid="markdown-rendered">{content}</div>
    ),
}));

jest.mock('../../../utils/inboxService', () => ({
    analyzeInboxText: jest.fn(),
}));

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
    deleteTask: jest.fn(),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
    fetchAssignablePeopleForProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../TaskComments', () => ({
    __esModule: true,
    default: () => <div data-testid="task-comments" />,
}));

jest.mock('../TaskDetails/TaskAttachmentsCard', () => ({
    __esModule: true,
    default: () => <div data-testid="task-attachments" />,
}));

jest.mock('../TaskDetails/TaskSubtasksCard', () => ({
    __esModule: true,
    default: ({ onQuickAdd }: any) => (
        <button
            type="button"
            data-testid="add-subtask"
            onClick={() => onQuickAdd('Buy hinges')}
        />
    ),
}));

jest.mock('../../../store/useStore', () => {
    const state: any = {
        projectsStore: { projects: [{ id: 7, name: 'Shed' }] },
        areasStore: { areas: [] },
        tagsStore: {
            tags: [],
            hasLoaded: true,
            isLoading: false,
            loadTags: jest.fn(),
            addNewTags: jest.fn(),
        },
        tasksStore: { updateTaskInStore: jest.fn() },
    };
    const useStore: any = (selector: (s: any) => any) => selector(state);
    useStore.getState = () => state;
    return { useStore };
});

const task: any = {
    id: 1,
    uid: 't-1',
    name: 'Fix the gate',
    note: '',
    status: 0,
    priority: 0,
    project_id: null,
    area_id: null,
    due_date: null,
    tags: [],
};

const renderPanel = () => {
    const onClose = jest.fn();
    render(<TaskModal isOpen onClose={onClose} task={task} />);
    return { onClose };
};

describe('TaskModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (analyzeInboxText as jest.Mock).mockImplementation(
            async (text: string) => ({
                cleaned_content: text,
                parsed_tags: [],
                parsed_projects: [],
                parsed_area: null,
                parsed_due_date: null,
            })
        );
        (updateTask as jest.Mock).mockResolvedValue({});
        (fetchTaskByUid as jest.Mock).mockResolvedValue({
            ...task,
            name: 'Fixed',
        });
    });

    it('sends only the name when only the name changed', async () => {
        const { onClose } = renderPanel();

        fireEvent.change(screen.getByTestId('task-name-input'), {
            target: { value: 'Fixed the gate' },
        });
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', {
                name: 'Fixed the gate',
            })
        );
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('opens a written note as rendered markdown and switches to edit', async () => {
        const onClose = jest.fn();
        render(
            <TaskModal
                isOpen
                onClose={onClose}
                task={{ ...task, note: '**Call** the fencer' }}
            />
        );

        expect(screen.getByTestId('markdown-rendered')).toHaveTextContent(
            '**Call** the fencer'
        );
        expect(
            screen.queryByRole('textbox', { name: /description/i })
        ).toBeNull();

        fireEvent.click(screen.getByTestId('task-note-edit-tab'));
        fireEvent.change(screen.getByLabelText('Description'), {
            target: { value: 'Call the fencer today' },
        });
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', {
                note: 'Call the fencer today',
            })
        );
    });

    it('opens an empty note ready to type', () => {
        renderPanel();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.queryByTestId('task-note-preview')).toBeNull();
    });

    it('picks a status from the colored dropdown', async () => {
        renderPanel();

        fireEvent.click(screen.getByTestId('task-status-select'));
        fireEvent.click(screen.getByTestId('task-status-option-in_progress'));
        expect(screen.getByTestId('task-status-select')).toHaveAttribute(
            'data-status',
            'in_progress'
        );
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', { status: 1 })
        );
    });

    it('shows subtasks, attachments and comments, and adds a subtask straight away', async () => {
        renderPanel();

        expect(screen.getByTestId('task-attachments')).toBeInTheDocument();
        expect(screen.getByTestId('task-comments')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('add-subtask'));
        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', {
                subtasks: [
                    expect.objectContaining({
                        name: 'Buy hinges',
                        parent_task_id: 1,
                    }),
                ],
            })
        );
    });

    it('leaves untouched assignee, defer and recurrence out of the update', async () => {
        renderPanel();

        fireEvent.click(screen.getByTestId('task-status-select'));
        fireEvent.click(screen.getByTestId('task-status-option-waiting'));
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() => expect(updateTask).toHaveBeenCalled());
        const payload = (updateTask as jest.Mock).mock.calls[0][1];
        expect(payload).not.toHaveProperty('recurrence_type');
        expect(payload).not.toHaveProperty('defer_until');
        expect(payload).not.toHaveProperty('assigned_to');
    });

    it('closes without calling the API when nothing changed', async () => {
        const { onClose } = renderPanel();

        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(updateTask).not.toHaveBeenCalled();
    });

    it('moves typed #tags and +project out of the name on save', async () => {
        (analyzeInboxText as jest.Mock).mockResolvedValue({
            cleaned_content: 'Fix the shed door',
            parsed_tags: ['errand'],
            parsed_projects: ['Shed'],
            parsed_area: null,
            parsed_due_date: null,
        });
        renderPanel();

        fireEvent.change(screen.getByTestId('task-name-input'), {
            target: { value: 'Fix the shed door #errand +Shed' },
        });
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', {
                name: 'Fix the shed door',
                project_id: 7,
                tags: [{ name: 'errand' }],
            })
        );
    });

    it('sends the chosen project as project_id', async () => {
        renderPanel();

        fireEvent.click(screen.getByTestId('task-project-select'));
        fireEvent.click(screen.getByRole('option', { name: 'Shed' }));
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', { project_id: 7 })
        );
    });
});
