import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskRow from '../TaskRow';
import { TaskRowExpansionProvider } from '../TaskRow/TaskRowExpansionContext';
import { Task } from '../../../entities/Task';
import * as tasksService from '../../../utils/tasksService';

const navigateMock = jest.fn();

jest.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/today', search: '' }),
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
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
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
    deleteTask: jest.fn(),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
    fetchAssignablePeopleForProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
    getLocaleFirstDayOfWeek: jest.fn().mockReturnValue(1),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) =>
        selector({
            tagsStore: { tags: [], loadTags: jest.fn() },
        }),
}));

// The status control + heavy editors are exercised elsewhere; keep this test
// focused on row layout + expansion.
jest.mock('../TaskStatusControl', () => ({
    __esModule: true,
    default: () => <div data-testid="status-control" />,
}));

const baseTask = (over: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Buy tickets',
    status: 'not_started',
    completed_at: null,
    ...over,
});

const renderRow = (task: Task, props: any = {}) =>
    render(
        <TaskRowExpansionProvider>
            <TaskRow
                task={task}
                projects={[]}
                onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                onTaskDelete={jest.fn()}
                {...props}
            />
        </TaskRowExpansionProvider>
    );

describe('TaskRow', () => {
    beforeEach(() => navigateMock.mockClear());

    it('renders the task title collapsed', () => {
        renderRow(baseTask());
        expect(screen.getByText('Buy tickets')).toBeInTheDocument();
        expect(
            screen.queryByPlaceholderText('Task name')
        ).not.toBeInTheDocument();
    });

    it('expands into the quick-edit panel on click', () => {
        renderRow(baseTask());
        fireEvent.click(screen.getByText('Buy tickets'));
        expect(screen.getByDisplayValue('Buy tickets')).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it('collapses on Escape', () => {
        renderRow(baseTask());
        fireEvent.click(screen.getByText('Buy tickets'));
        expect(screen.getByDisplayValue('Buy tickets')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(
            screen.queryByDisplayValue('Buy tickets')
        ).not.toBeInTheDocument();
    });

    it('collapses on a click outside the row', () => {
        renderRow(baseTask());
        fireEvent.click(screen.getByText('Buy tickets'));
        expect(screen.getByDisplayValue('Buy tickets')).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(
            screen.queryByDisplayValue('Buy tickets')
        ).not.toBeInTheDocument();
    });

    it('keeps only one row expanded at a time', () => {
        render(
            <TaskRowExpansionProvider>
                <TaskRow
                    task={baseTask({ id: 1, uid: 'a', name: 'Task A' })}
                    projects={[]}
                    onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                    onTaskDelete={jest.fn()}
                />
                <TaskRow
                    task={baseTask({ id: 2, uid: 'b', name: 'Task B' })}
                    projects={[]}
                    onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                    onTaskDelete={jest.fn()}
                />
            </TaskRowExpansionProvider>
        );
        fireEvent.click(screen.getByText('Task A'));
        expect(screen.getByDisplayValue('Task A')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Task B'));
        expect(screen.getByDisplayValue('Task B')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Task A')).not.toBeInTheDocument();
    });

    it('navigates to the full page when expansion is disabled', () => {
        renderRow(baseTask(), { disableExpand: true });
        fireEvent.click(screen.getByText('Buy tickets'));
        expect(navigateMock).toHaveBeenCalledWith(
            '/task/task-1',
            expect.objectContaining({ state: expect.any(Object) })
        );
    });

    it('routes habit tasks to the habit page', () => {
        renderRow(baseTask({ habit_mode: true }));
        fireEvent.click(screen.getByText('Buy tickets'));
        expect(navigateMock).toHaveBeenCalledWith(
            '/habit/task-1',
            expect.anything()
        );
    });

    it('saves an edited title via updateTask with a field-only payload', async () => {
        const updateTaskMock = tasksService.updateTask as jest.Mock;
        updateTaskMock.mockResolvedValue({
            ...baseTask(),
            name: 'Buy 2 tickets',
        });
        const onTaskUpdate = jest.fn().mockResolvedValue(undefined);
        render(
            <TaskRowExpansionProvider>
                <TaskRow
                    task={baseTask()}
                    projects={[]}
                    onTaskUpdate={onTaskUpdate}
                    onTaskDelete={jest.fn()}
                />
            </TaskRowExpansionProvider>
        );
        fireEvent.click(screen.getByText('Buy tickets'));
        const input = screen.getByDisplayValue('Buy tickets');
        fireEvent.change(input, { target: { value: 'Buy 2 tickets' } });
        fireEvent.blur(input);
        await waitFor(() =>
            expect(updateTaskMock).toHaveBeenCalledWith('task-1', {
                name: 'Buy 2 tickets',
            })
        );
        const payload = updateTaskMock.mock.calls[0][1];
        expect(payload).not.toHaveProperty('subtasks');
    });
});
