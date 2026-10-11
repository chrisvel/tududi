import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useSWR from 'swr';
import WeeklyPlan from './WeeklyPlan';
import { createGoal } from '../../utils/goalsService';
import { refreshPlanning } from '../../utils/planningService';
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            key === 'ltdPlanning.threeEnough' ? 'سه تا کافی است؟' : key,
    }),
}));
jest.mock('../../utils/goalsService', () => ({ createGoal: jest.fn() }));
jest.mock('../../utils/planningService', () => ({
    ...jest.requireActual('../../utils/planningService'),
    refreshPlanning: jest.fn().mockResolvedValue(undefined),
}));
const priorities = Array.from({ length: 3 }, (_, i) => ({
    id: i,
    uid: `week-${i}`,
    title: `Priority ${i}`,
    horizon: 'week',
    period_start: '2000-01-01',
    period_end: '2100-01-01',
    children: [],
    progress: { A: null, O: null, health: null },
}));
it('saves a fourth priority as a week goal and shows only a soft warning', async () => {
    (useSWR as jest.Mock).mockReturnValue({ data: { goals: priorities } });
    (createGoal as jest.Mock).mockResolvedValue({ goal: {} });
    const { rerender } = render(
        <MemoryRouter>
            <WeeklyPlan />
        </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('ltdPlanning.priorityTitle'), {
        target: { value: 'Fourth priority' },
    });
    fireEvent.click(
        screen.getByRole('button', { name: 'ltdPlanning.addPriority' })
    );
    await waitFor(() =>
        expect(createGoal).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Fourth priority',
                horizon: 'week',
                status: 'active',
            })
        )
    );
    expect(refreshPlanning).toHaveBeenCalled();
    (useSWR as jest.Mock).mockReturnValue({
        data: { goals: [...priorities, { ...priorities[0], uid: 'fourth' }] },
    });
    rerender(
        <MemoryRouter>
            <WeeklyPlan />
        </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent('سه تا کافی است؟');
    expect(
        screen.getByRole('button', { name: 'ltdPlanning.addPriority' })
    ).not.toBeDisabled();
});
