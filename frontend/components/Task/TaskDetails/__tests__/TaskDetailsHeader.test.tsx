import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TaskDetailsHeader from '../TaskDetailsHeader';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

const task: any = {
    id: 1,
    uid: 'task-1',
    name: 'Electricity bill',
    status: 'not_started',
    priority: 'medium',
    recurrence_type: 'monthly',
};

const renderHeader = (props: Record<string, any> = {}) =>
    render(
        <MemoryRouter>
            <TaskDetailsHeader
                task={task}
                onTitleUpdate={jest.fn()}
                onStatusUpdate={jest.fn()}
                onPriorityUpdate={jest.fn()}
                onDelete={jest.fn()}
                activePill="overview"
                onPillChange={jest.fn()}
                onQuickStatusToggle={jest.fn()}
                {...props}
            />
        </MemoryRouter>
    );

describe('TaskDetailsHeader actions menu', () => {
    it('offers to skip the occurrence when a handler is given', () => {
        const onSkipOccurrence = jest.fn();
        renderHeader({ onSkipOccurrence });

        fireEvent.click(screen.getByLabelText('More actions'));
        fireEvent.click(screen.getByText('Skip this occurrence'));

        expect(onSkipOccurrence).toHaveBeenCalledTimes(1);
    });

    it('hides the skip action without a handler', () => {
        renderHeader();

        fireEvent.click(screen.getByLabelText('More actions'));

        expect(
            screen.queryByText('Skip this occurrence')
        ).not.toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });
});
