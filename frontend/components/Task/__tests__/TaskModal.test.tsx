import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskModal from '../TaskModal';
import { updateTask, fetchTaskByUid } from '../../../utils/tasksService';

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

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
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

    it('closes without calling the API when nothing changed', () => {
        const { onClose } = renderPanel();

        fireEvent.click(screen.getByTestId('task-save-button'));

        expect(updateTask).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('sends the chosen project as project_id', async () => {
        renderPanel();

        fireEvent.change(screen.getByTestId('task-project-select'), {
            target: { value: '7' },
        });
        fireEvent.click(screen.getByTestId('task-save-button'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('t-1', { project_id: 7 })
        );
    });
});
