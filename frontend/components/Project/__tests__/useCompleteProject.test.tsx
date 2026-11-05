import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useCompleteProject from '../useCompleteProject';
import { ToastProvider } from '../../Shared/ToastContext';
import { Project } from '../../../entities/Project';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

const mockCompleteProject = jest.fn();

jest.mock('../../../utils/projectsService', () => ({
    completeProject: (...args: any[]) => mockCompleteProject(...args),
}));

const project: Project = { uid: 'p1', name: 'Kitchen', status: 'in_progress' };

const Harness: React.FC<{ openTasks: number; onDone: jest.Mock }> = ({
    openTasks,
    onDone,
}) => {
    const { requestComplete, completeDialog } = useCompleteProject();
    return (
        <>
            <button onClick={() => requestComplete(project, openTasks, onDone)}>
                complete
            </button>
            {completeDialog}
        </>
    );
};

const renderHarness = (openTasks: number, onDone = jest.fn()) =>
    render(
        <ToastProvider>
            <Harness openTasks={openTasks} onDone={onDone} />
        </ToastProvider>
    );

describe('useCompleteProject', () => {
    beforeEach(() => {
        mockCompleteProject.mockReset();
        mockCompleteProject.mockResolvedValue({
            project: { ...project, status: 'done' },
            completed_tasks: 0,
        });
    });

    it('completes straight away when nothing is open', async () => {
        const onDone = jest.fn();
        renderHarness(0, onDone);

        fireEvent.click(screen.getByText('complete'));

        await waitFor(() =>
            expect(mockCompleteProject).toHaveBeenCalledWith('p1', false)
        );
        expect(onDone).toHaveBeenCalled();
        expect(
            screen.queryByTestId('complete-project-dialog')
        ).not.toBeInTheDocument();
    });

    it('asks first when tasks are open and can finish them too', async () => {
        renderHarness(3);

        fireEvent.click(screen.getByText('complete'));
        expect(mockCompleteProject).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('complete-project-with-tasks'));

        await waitFor(() =>
            expect(mockCompleteProject).toHaveBeenCalledWith('p1', true)
        );
    });

    it('can leave open tasks alone', async () => {
        renderHarness(3);

        fireEvent.click(screen.getByText('complete'));
        fireEvent.click(screen.getByTestId('complete-project-leave-tasks'));

        await waitFor(() =>
            expect(mockCompleteProject).toHaveBeenCalledWith('p1', false)
        );
    });
});
