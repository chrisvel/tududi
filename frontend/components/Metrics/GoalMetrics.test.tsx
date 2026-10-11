import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR from 'swr';
import GoalMetrics from './GoalMetrics';
import {
    checkinMetric,
    saveGoalMetric,
    refreshPlanning,
} from '../../utils/planningService';
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));
jest.mock('../../utils/planningService', () => ({
    planningKeys: { metrics: (uid: string) => uid },
    fetchGoalMetrics: jest.fn(),
    checkinMetric: jest.fn(),
    saveGoalMetric: jest.fn(),
    deleteGoalMetric: jest.fn(),
    refreshPlanning: jest.fn().mockResolvedValue(undefined),
}));
const metric = {
    uid: 'metric',
    name: 'Weight',
    baseline: 100,
    target: 80,
    direction: 'decrease',
    current_value: 90,
    weight: 1,
    source: 'manual',
    checkins: [
        {
            uid: 'entry',
            value: 90,
            note: 'Steady',
            recorded_at: '2026-10-11T12:00:00Z',
        },
    ],
};
beforeEach(() => {
    jest.clearAllMocks();
    (useSWR as jest.Mock).mockReturnValue({ data: { metrics: [metric] } });
});
it('check-ins preserve the numeric value and note, then refresh both signals', async () => {
    (checkinMetric as jest.Mock).mockResolvedValue({});
    render(<GoalMetrics goalUid="goal" />);
    fireEvent.change(screen.getByLabelText('ltdPlanning.valueFor:Weight'), {
        target: { value: '85' },
    });
    fireEvent.change(screen.getByLabelText('ltdPlanning.noteFor:Weight'), {
        target: { value: 'A small step' },
    });
    fireEvent.click(
        screen.getByRole('button', { name: 'ltdPlanning.checkin' })
    );
    await waitFor(() =>
        expect(checkinMetric).toHaveBeenCalledWith('metric', 85, 'A small step')
    );
    expect(refreshPlanning).toHaveBeenCalled();
    expect(screen.getByText('Steady')).toBeInTheDocument();
});
it('metric editing sends only editable fields, keeping current_value exclusive to check-in', async () => {
    (saveGoalMetric as jest.Mock).mockResolvedValue({});
    render(<GoalMetrics goalUid="goal" />);
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    fireEvent.change(screen.getByLabelText('ltdPlanning.target'), {
        target: { value: '75' },
    });
    fireEvent.click(
        screen.getByRole('button', { name: 'ltdPlanning.updateMetric' })
    );
    await waitFor(() =>
        expect(saveGoalMetric).toHaveBeenCalledWith(
            'goal',
            expect.objectContaining({
                uid: 'metric',
                target: 75,
                baseline: 100,
                direction: 'decrease',
            })
        )
    );
    expect((saveGoalMetric as jest.Mock).mock.calls[0][1]).not.toHaveProperty(
        'current_value'
    );
    expect((saveGoalMetric as jest.Mock).mock.calls[0][1]).not.toHaveProperty(
        'checkins'
    );
});
it('an Undo refresh replaces the default check-in value with restored current_value', () => {
    const { rerender } = render(<GoalMetrics goalUid="goal" />);
    expect(screen.getByLabelText('ltdPlanning.valueFor:Weight')).toHaveValue(
        90
    );
    (useSWR as jest.Mock).mockReturnValue({
        data: { metrics: [{ ...metric, current_value: 100 }] },
    });
    rerender(<GoalMetrics goalUid="goal" />);
    expect(screen.getByLabelText('ltdPlanning.valueFor:Weight')).toHaveValue(
        100
    );
});
