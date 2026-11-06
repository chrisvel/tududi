import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import RoadmapChart from '../RoadmapChart';
import { fetchRoadmap } from '../../../utils/roadmapService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) =>
            typeof fallback === 'string'
                ? fallback.replace(
                      /{{(\w+)}}/g,
                      (_: string, name: string) => options?.[name] ?? ''
                  )
                : key,
    }),
}));

jest.mock('../../Task/TaskModal', () => ({
    __esModule: true,
    default: ({ task }: any) => <div>panel for {task.name}</div>,
}));

jest.mock('../../../utils/roadmapService', () => ({
    fetchRoadmap: jest.fn(),
}));

jest.mock('../../../utils/tasksService', () => ({
    fetchTaskByUid: jest.fn(async (uid: string) => ({
        uid,
        name: 'Full task',
    })),
}));

const response = {
    from: '2026-10-01',
    to: '2026-12-31',
    goals: [
        {
            uid: 'g1',
            title: 'Milestone 2',
            target_date: '2026-11-13',
            status: 'active',
            area_uid: 'a1',
        },
    ],
    goals_outside: 1,
    areas: [
        {
            uid: 'a1',
            name: 'DST',
            color: null,
            start: '2026-11-03',
            end: '2026-12-09',
            projects: [
                {
                    uid: 'p1',
                    name: 'BIM reviews',
                    status: 'in_progress',
                    start: '2026-11-03',
                    end: '2026-12-09',
                    dated_from_tasks: true,
                    task_count: 2,
                    tasks: [
                        {
                            uid: 't1',
                            name: 'Conduct review',
                            status: 0,
                            start_date: null,
                            due_date: '2026-11-03',
                            kind: 'due',
                        },
                        {
                            uid: 't2',
                            name: 'Close actions',
                            status: 0,
                            start_date: '2026-11-23',
                            due_date: '2026-12-09',
                            kind: 'range',
                        },
                    ],
                },
            ],
        },
    ],
};

const renderChart = (props = {}) =>
    render(
        <MemoryRouter initialEntries={['/roadmap?q=2026-Q4']}>
            <RoadmapChart {...props} />
        </MemoryRouter>
    );

describe('RoadmapChart', () => {
    beforeEach(() => {
        localStorage.clear();
        (fetchRoadmap as jest.Mock).mockReset();
        (fetchRoadmap as jest.Mock).mockResolvedValue(response);
    });

    it('asks for the quarter in the URL and pins its goals', async () => {
        renderChart();

        expect(await screen.findByText('Milestone 2')).toBeInTheDocument();
        expect(fetchRoadmap).toHaveBeenCalledWith('2026-10-01', 92, undefined);
        expect(screen.getByTestId('roadmap-quarter')).toHaveTextContent(
            'Q4 2026'
        );
        expect(screen.getByText('Outside this quarter: 1')).toBeInTheDocument();
    });

    it('starts with areas open and goes down to tasks and back', async () => {
        const user = userEvent.setup();
        renderChart();

        expect(await screen.findByText('BIM reviews')).toBeInTheDocument();
        expect(screen.queryByText('Conduct review')).not.toBeInTheDocument();

        await user.click(screen.getByTestId('roadmap-toggle-project:p1'));
        expect(screen.getByText('Conduct review')).toBeInTheDocument();
        expect(screen.getByText('Close actions')).toBeInTheDocument();

        await user.click(screen.getByTestId('roadmap-toggle-area:a1'));
        expect(screen.queryByText('BIM reviews')).not.toBeInTheDocument();
        expect(screen.queryByText('Conduct review')).not.toBeInTheDocument();
    });

    it('expands and collapses everything and remembers it', async () => {
        const user = userEvent.setup();
        const { unmount } = renderChart();
        await screen.findByText('BIM reviews');

        await user.click(screen.getByText('Expand all'));
        expect(screen.getByText('Conduct review')).toBeInTheDocument();

        unmount();
        renderChart();
        expect(await screen.findByText('Conduct review')).toBeInTheDocument();

        await user.click(screen.getByText('Collapse all'));
        expect(screen.queryByText('BIM reviews')).not.toBeInTheDocument();
    });

    it('changes quarter across the year end', async () => {
        const user = userEvent.setup();
        renderChart();
        await screen.findByText('Milestone 2');

        await user.click(screen.getByTestId('roadmap-next'));

        await waitFor(() =>
            expect(fetchRoadmap).toHaveBeenLastCalledWith(
                '2027-01-01',
                90,
                undefined
            )
        );
        expect(screen.getByTestId('roadmap-quarter')).toHaveTextContent(
            'Q1 2027'
        );
    });

    it('opens a task in the panel with its full details', async () => {
        const user = userEvent.setup();
        renderChart();
        await screen.findByText('BIM reviews');
        await user.click(screen.getByTestId('roadmap-toggle-project:p1'));

        await user.click(screen.getByText('Close actions'));

        expect(
            await screen.findByText('panel for Full task')
        ).toBeInTheDocument();
    });

    it('explains itself when there is nothing to show', async () => {
        (fetchRoadmap as jest.Mock).mockResolvedValue({
            ...response,
            goals: [],
            goals_outside: 0,
            areas: [],
        });
        renderChart();

        expect(
            await screen.findByText(/Bars come from the start and due dates/)
        ).toBeInTheDocument();
    });

    it('says so when loading fails', async () => {
        (fetchRoadmap as jest.Mock).mockRejectedValue(new Error('nope'));
        renderChart();

        expect(
            await screen.findByText('Could not load the roadmap.')
        ).toBeInTheDocument();
    });
});
