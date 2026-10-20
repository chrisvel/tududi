import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotPlannedDrawer from '../NotPlannedDrawer';
import { PlanCandidates } from '../../../utils/dailyPlanService';

jest.mock('react-i18next', () => {
    const t = (
        _key: string,
        fallback: string | Record<string, unknown>,
        values?: Record<string, unknown>
    ) => {
        const options = typeof fallback === 'object' ? fallback : values;
        const text =
            typeof fallback === 'string'
                ? fallback
                : String(fallback?.defaultValue ?? _key);
        return text.replace(/{{(\w+)}}/g, (_m, name) =>
            String(options?.[name] ?? '')
        );
    };
    const value = { t, i18n: { language: 'en' } };
    return { useTranslation: () => value };
});

jest.mock('../../Task/TaskRow', () => ({
    __esModule: true,
    default: ({ task }: { task: { name: string } }) => <div>{task.name}</div>,
}));

const candidates: PlanCandidates = {
    tagged_today: [],
    overdue: [{ uid: 't-late', name: 'Renew insurance' } as any],
    due_today: [],
    in_progress: [],
    suggested: [],
    inbox: [],
    inbox_count: 0,
};

describe('NotPlannedDrawer', () => {
    it('shows only the plus icon on phones and keeps the label for screen readers', () => {
        const onAdd = jest.fn();
        render(
            <NotPlannedDrawer
                candidates={candidates}
                plannedUids={new Set()}
                onAdd={onAdd}
                projects={[]}
                onTaskUpdate={jest.fn()}
                onTaskDelete={jest.fn()}
            />
        );
        fireEvent.click(screen.getByTestId('not-planned-toggle'));

        const add = screen.getByRole('button', { name: 'Add to today' });
        expect(screen.getByText('Add to today')).toHaveClass(
            'hidden',
            'sm:inline'
        );

        fireEvent.click(add);
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ uid: 't-late' })
        );
    });
});
