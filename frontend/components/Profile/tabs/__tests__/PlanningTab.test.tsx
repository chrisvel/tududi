import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import PlanningTab from '../PlanningTab';
import {
    fetchPlanRanking,
    savePlanRanking,
    RankingBucket,
} from '../../../../utils/dailyPlanService';

jest.mock('react-i18next', () => {
    const t = (key: string, fallback?: any, options?: any) => {
        if (typeof fallback !== 'string') return key;
        return fallback.replace(
            /\{\{(\w+)\}\}/g,
            (_: string, name: string) => options?.[name] ?? ''
        );
    };
    const value = { t };
    return { useTranslation: () => value };
});

const showErrorToast = jest.fn();
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast }),
}));

jest.mock('../../../../utils/dailyPlanService', () => ({
    fetchPlanRanking: jest.fn(),
    savePlanRanking: jest.fn(),
}));

const DEFAULT: RankingBucket[] = [
    'overdue:project',
    'overdue:none',
    'due_today:project',
    'due_today:none',
    'in_progress:project',
    'in_progress:none',
    'suggested:project',
    'suggested:none',
];

const rows = () =>
    screen
        .getAllByTestId(/^planning-bucket-/)
        .map((row) => row.getAttribute('data-testid'));

const renderTab = () =>
    render(
        <MemoryRouter>
            <PlanningTab isActive />
        </MemoryRouter>
    );

describe('PlanningTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetchPlanRanking as jest.Mock).mockResolvedValue({
            order: DEFAULT,
            default_order: DEFAULT,
        });
        (savePlanRanking as jest.Mock).mockImplementation(async (order) => ({
            order,
            default_order: DEFAULT,
        }));
    });

    it('lists every group split by project and no project', async () => {
        renderTab();
        await waitFor(() => expect(rows()).toHaveLength(8));
        expect(screen.getByText('Overdue · in a project')).toBeInTheDocument();
        expect(
            screen.getByText('Everything else · no project')
        ).toBeInTheDocument();
        expect(screen.queryByText('Reset to default')).not.toBeInTheDocument();
    });

    it('moves a row and saves the new order', async () => {
        renderTab();
        await waitFor(() => expect(rows()).toHaveLength(8));

        fireEvent.click(
            screen.getByRole('button', { name: 'Move Overdue · no project up' })
        );

        const expected = [
            'overdue:none',
            'overdue:project',
            ...DEFAULT.slice(2),
        ];
        expect(savePlanRanking).toHaveBeenCalledWith(expected);
        expect(rows()[0]).toBe('planning-bucket-overdue:none');

        fireEvent.click(screen.getByText('Reset to default'));
        expect(savePlanRanking).toHaveBeenLastCalledWith(DEFAULT);
    });

    it('puts the old order back when saving fails', async () => {
        (savePlanRanking as jest.Mock).mockRejectedValue(new Error('nope'));
        renderTab();
        await waitFor(() => expect(rows()).toHaveLength(8));

        fireEvent.click(
            screen.getByRole('button', { name: 'Move Overdue · no project up' })
        );

        await waitFor(() =>
            expect(rows()[0]).toBe('planning-bucket-overdue:project')
        );
        expect(showErrorToast).toHaveBeenCalled();
    });
});
