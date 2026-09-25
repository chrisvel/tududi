import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import CandidateList from '../CandidateList';
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

const task = (uid: string, name: string, extra = {}) =>
    ({ uid, name, status: 'not_started', ...extra }) as any;

const candidates: PlanCandidates = {
    overdue: [task('t-late', 'Renew insurance', { due_date: '2026-09-20' })],
    due_today: [task('t-today', 'Pay rent')],
    in_progress: [task('t-started', 'Draft report')],
    suggested: [task('t-idea', 'Sort photos')],
    inbox: [],
    inbox_count: 0,
};

const renderList = (list: PlanCandidates = candidates) =>
    render(
        <MemoryRouter initialEntries={['/today/plan']}>
            <CandidateList
                candidates={list}
                planned={new Map()}
                filter="all"
                onFilterChange={jest.fn()}
                durations={{}}
                onDurationChange={jest.fn()}
                onAdd={jest.fn()}
                onRemove={jest.fn()}
                onReschedule={jest.fn()}
                onDrop={jest.fn()}
                onAddInbox={jest.fn()}
                today="2026-09-25"
            />
        </MemoryRouter>
    );

describe('CandidateList', () => {
    it('shows overdue, due today, in progress, then the rest', () => {
        renderList();
        const names = screen
            .getAllByTestId(/^candidate-open-/)
            .map((link) => link.textContent);
        expect(names).toEqual([
            'Renew insurance',
            'Pay rent',
            'Draft report',
            'Sort photos',
        ]);
    });

    it('follows the ranking order from the server', () => {
        renderList({
            ...candidates,
            ranked: ['t-idea', 't-late', 't-started', 't-today'],
        });
        const names = screen
            .getAllByTestId(/^candidate-open-/)
            .map((link) => link.textContent);
        expect(names).toEqual([
            'Sort photos',
            'Renew insurance',
            'Draft report',
            'Pay rent',
        ]);
    });

    it('opens the task when its name is clicked', () => {
        renderList();
        expect(
            screen.getByRole('link', { name: 'Renew insurance' })
        ).toHaveAttribute('href', '/task/t-late');
    });
});
