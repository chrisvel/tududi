import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TFunction } from 'i18next';
import ProjectTimeline from '../ProjectTimeline';
import { Project } from '../../../../entities/Project';
import { Task } from '../../../../entities/Task';

const t = ((_key: string, fallback?: string, options?: any) =>
    (fallback ?? '').replace(
        /{{(\w+)}}/g,
        (_: string, name: string) => options?.[name] ?? ''
    )) as unknown as TFunction;

const task = (uid: string, extra: Partial<Task>): Task =>
    ({ uid, name: uid, status: 0, ...extra }) as Task;

const renderTimeline = (project: Partial<Project>, tasks: Task[]) =>
    render(
        <ProjectTimeline
            project={{ uid: 'p1', name: 'BIM', ...project } as Project}
            tasks={tasks}
            links={[]}
            onDatesChange={jest.fn()}
            onOpenTask={jest.fn()}
            t={t}
        />
    );

describe('ProjectTimeline summary row', () => {
    it('runs from the earliest start to the latest finish', () => {
        renderTimeline({}, [
            task('range', { start_date: '2026-11-04', due_date: '2026-11-20' }),
            task('due', { due_date: '2026-11-03' }),
        ]);

        expect(screen.getByText('Project summary')).toBeInTheDocument();
        expect(screen.getByText('Nov 3 to Nov 20')).toBeInTheDocument();
        expect(
            screen.getByTestId('project-timeline-summary')
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId('project-timeline-goal')
        ).not.toBeInTheDocument();
    });

    it("pins the project's goal on its target date", () => {
        renderTimeline(
            {
                Goal: {
                    uid: 'g1',
                    title: 'Milestone 2',
                    target_date: '2026-11-13',
                } as Project['Goal'],
            },
            [task('due', { due_date: '2026-11-03' })]
        );

        expect(screen.getByTestId('project-timeline-goal')).toHaveAttribute(
            'title',
            'Milestone 2, Nov 13'
        );
    });

    it('has no row with nothing dated', () => {
        renderTimeline({}, [task('undated', {})]);

        expect(screen.queryByText('Project summary')).not.toBeInTheDocument();
    });
});
