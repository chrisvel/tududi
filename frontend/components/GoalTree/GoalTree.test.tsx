import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useSWR from 'swr';
import GoalTree from './GoalTree';
import GoalProgressBars from './GoalProgressBars';
import TaskWhyChain from './TaskWhyChain';
import { updateGoal } from '../../utils/goalsService';
import { GoalNode, refreshPlanning } from '../../utils/planningService';

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) =>
            options?.title ? `${key}:${options.title}` : key,
    }),
}));
jest.mock('../../utils/goalsService', () => ({ updateGoal: jest.fn() }));
jest.mock('../../utils/planningService', () => ({
    ...jest.requireActual('../../utils/planningService'),
    refreshPlanning: jest.fn().mockResolvedValue(undefined),
}));
jest.mock(
    '../Journal/JournalPanel',
    () =>
        function MockJournalPanel() {
            return <div />;
        }
);
const progress = {
    A: 1,
    O: 0.4,
    expected: 0.5,
    health: 'needs_love' as const,
    achievement_suggested: false,
    whyChain: [],
};
const season: GoalNode = {
    id: 2,
    uid: 'season',
    title: 'فصل Test',
    horizon: 'season',
    status: 'active',
    parent_goal_id: 1,
    children: [],
    progress,
};
const year: GoalNode = {
    id: 1,
    uid: 'year',
    title: 'Year',
    horizon: 'year',
    status: 'active',
    children: [season],
    progress,
};
beforeEach(() => {
    jest.clearAllMocks();
    (useSWR as jest.Mock).mockReturnValue({ data: { goals: [year] } });
});
function tree() {
    render(
        <MemoryRouter>
            <GoalTree />
        </MemoryRouter>
    );
}
it('uses separate activity and outcome bars without displaying null outcome as zero', () => {
    const { rerender } = render(<GoalProgressBars progress={progress} />);
    expect(screen.getByTestId('goal-progress-A')).toHaveTextContent('100%');
    expect(screen.getByTestId('goal-progress-O')).toHaveTextContent('40%');
    rerender(<GoalProgressBars progress={{ ...progress, O: null }} />);
    expect(screen.getByTestId('goal-progress-O')).toHaveTextContent(
        'ltdPlanning.noOutcome'
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
});
it('moves through the keyboard equivalent selector, then refreshes related reads', async () => {
    (updateGoal as jest.Mock).mockResolvedValue({ goal: season });
    tree();
    fireEvent.change(screen.getByLabelText('ltdPlanning.parentFor:فصل Test'), {
        target: { value: '' },
    });
    const item = screen.getByTestId('goal-node-season');
    fireEvent.click(item.querySelector('button')!);
    await waitFor(() =>
        expect(updateGoal).toHaveBeenCalledWith('season', {
            parent_goal_id: null,
        })
    );
    await waitFor(() => expect(refreshPlanning).toHaveBeenCalled());
});
it('shows a service hierarchy rejection without assuming the move succeeded', async () => {
    (updateGoal as jest.Mock).mockRejectedValue(
        new Error('Child horizon must be shorter than parent horizon')
    );
    tree();
    fireEvent.change(screen.getByLabelText('ltdPlanning.parentFor:Year'), {
        target: { value: '2' },
    });
    fireEvent.click(
        screen.getByTestId('goal-node-year').querySelector('button')!
    );
    await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Child horizon must be shorter'
        )
    );
    expect(refreshPlanning).not.toHaveBeenCalled();
});
it('dragging onto a goal uses the same reparent service as the keyboard path', async () => {
    (updateGoal as jest.Mock).mockResolvedValue({ goal: season });
    tree();
    const transfer = { getData: () => 'season', setData: jest.fn() };
    fireEvent.drop(screen.getByTestId('goal-node-year').firstElementChild!, {
        dataTransfer: transfer,
    });
    await waitFor(() =>
        expect(updateGoal).toHaveBeenCalledWith('season', { parent_goal_id: 1 })
    );
});
it('renders the authoritative nearest-to-root task chain and isolates user text', () => {
    (useSWR as jest.Mock).mockReturnValue({
        data: { whyChain: [season, year] },
    });
    render(
        <MemoryRouter>
            <TaskWhyChain
                task={
                    { uid: 'task', name: 'Task', status: 0, goal_id: 2 } as any
                }
            />
        </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['فصل Test', 'Year']);
    expect(links[0].querySelector('bdi')).toHaveTextContent('فصل Test');
});
