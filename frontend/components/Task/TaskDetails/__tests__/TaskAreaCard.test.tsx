import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskAreaCard from '../TaskAreaCard';
import { Task } from '../../../../entities/Task';
import { Area } from '../../../../entities/Area';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

const areas: Area[] = [
    { id: 1, name: 'Work', uid: 'area-work' } as Area,
    { id: 2, name: 'Home', uid: 'area-home' } as Area,
];

const baseProps = {
    areas,
    onAreaSelect: jest.fn().mockResolvedValue(undefined),
    onAreaClear: jest.fn().mockResolvedValue(undefined),
    getAreaLink: (area: Area) => `/area/${area.uid}`,
};

describe('TaskAreaCard - area selection with a project', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('keeps the area selector visible when a project without an area is assigned', () => {
        const task = {
            id: 10,
            name: 'Task',
            Project: { id: 5, name: 'Some Project', uid: 'proj-5' },
        } as unknown as Task;

        render(<TaskAreaCard task={task} {...baseProps} />);

        expect(screen.getByText('Assign to an area')).toBeInTheDocument();
    });

    it('lets the user pick an area after assigning a project', async () => {
        const task = {
            id: 10,
            name: 'Task',
            Project: { id: 5, name: 'Some Project', uid: 'proj-5' },
        } as unknown as Task;

        render(<TaskAreaCard task={task} {...baseProps} />);

        fireEvent.click(screen.getByText('Assign to an area'));
        await act(async () => {
            fireEvent.click(screen.getByText('Work'));
        });

        expect(baseProps.onAreaSelect).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1, name: 'Work' })
        );
    });

    it('shows the task own area (editable) even when a project is assigned', () => {
        const task = {
            id: 10,
            name: 'Task',
            Area: { id: 2, name: 'Home', uid: 'area-home' },
            Project: { id: 5, name: 'Some Project', uid: 'proj-5' },
        } as unknown as Task;

        render(<TaskAreaCard task={task} {...baseProps} />);

        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.queryByText('via project')).not.toBeInTheDocument();
    });

    it('shows a read-only via-project card when the area is inherited from the project', () => {
        const task = {
            id: 10,
            name: 'Task',
            Project: {
                id: 5,
                name: 'Some Project',
                uid: 'proj-5',
                area_id: 1,
                Area: { id: 1, name: 'Work', uid: 'area-work' },
            },
        } as unknown as Task;

        render(<TaskAreaCard task={task} {...baseProps} />);

        expect(screen.getByText('Work')).toBeInTheDocument();
        expect(screen.getByText('via project')).toBeInTheDocument();
    });
});
