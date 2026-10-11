import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useSWR from 'swr';
import GoalHero from '../GoalHero';

jest.mock('swr', () => jest.fn());
jest.mock('../../../utils/planningService', () => ({
    fetchGoalProgress: jest.fn(),
    planningKeys: { progress: (uid: string) => uid },
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
const progress = {
    A: 1,
    O: 0.4,
    health: 'on_track',
    achievement_suggested: false,
};
const show = (data: typeof progress) => {
    (useSWR as jest.Mock).mockReturnValue({ data });
    const onStatusChange = jest.fn().mockResolvedValue(undefined);
    render(
        <MemoryRouter>
            <GoalHero
                goal={{
                    uid: 'goal1',
                    title: 'A meaningful outcome',
                    horizon: 'year',
                    status: 'active',
                }}
                t={((key: string) => key) as any}
                doneCount={10}
                totalCount={10}
                onStatusChange={onStatusChange}
                onShareClick={jest.fn()}
                onEditClick={jest.fn()}
                onDeleteClick={jest.fn()}
            />
        </MemoryRouter>
    );
    return onStatusChange;
};
it('all activities complete with 40% outcome remains active with two separate bars', () => {
    const change = show(progress);
    expect(screen.getByTestId('goal-progress-A')).toHaveTextContent('100%');
    expect(screen.getByTestId('goal-progress-O')).toHaveTextContent('40%');
    expect(
        screen.queryByText('ltdPlanning.achievementQuestion')
    ).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
});
it('threshold/date suggestion changes status only after the human clicks', () => {
    const change = show({ ...progress, O: 1, achievement_suggested: true });
    expect(screen.getByText('ltdPlanning.achievementQuestion')).toBeVisible();
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(
        screen.getByRole('button', { name: 'ltdPlanning.markAchieved' })
    );
    expect(change).toHaveBeenCalledWith('achieved');
});
