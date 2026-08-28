import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AreaDetails from '../AreaDetails';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

const area = {
    id: 1,
    uid: 'areauid1',
    name: 'Work',
    description: '',
    color: null,
};

const goals = [
    { uid: 'goal-1', title: 'Goal one', area_id: 1, status: 'active' },
    { uid: 'goal-2', title: 'Goal two', area_id: 1, status: 'active' },
];

const tasks = [
    { uid: 'task-1', name: 'Active task', status: 'not_started' },
    { uid: 'task-2', name: 'Done task', status: 'done' },
    { uid: 'task-3', name: 'Archived task', status: 'archived' },
];

const projects = [
    { uid: 'project-1', name: 'Project one', area: { uid: 'areauid1' } },
];

jest.mock('../../../utils/tasksService', () => ({
    fetchTasks: jest.fn(() => Promise.resolve({ tasks })),
}));

jest.mock('../../Task/TaskList', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../AreaModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) =>
        selector({
            areasStore: {
                areas: [area],
                isLoading: false,
                loadAreas: jest.fn(),
            },
            projectsStore: {
                projects,
                hasLoaded: true,
                isLoading: false,
                loadProjects: jest.fn(),
            },
            tasksStore: {
                tasks: [],
                setTasks: jest.fn(),
            },
            goalsStore: {
                goals,
                hasLoaded: true,
                isLoading: false,
                loadGoals: jest.fn(),
                setGoals: jest.fn(),
            },
        }),
}));

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/area/areauid1-work']}>
            <Routes>
                <Route path="/area/:uidSlug" element={<AreaDetails />} />
            </Routes>
        </MemoryRouter>
    );

describe('AreaDetails header stats', () => {
    it('shows the total task count (active + completed), matching the tasks list below', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText('3 tasks')).toBeInTheDocument();
        });

        expect(screen.getByText('2 goals')).toBeInTheDocument();
    });

    it('links the projects stat to the projects list filtered by this area', async () => {
        renderPage();

        const projectsLink = await screen.findByText('1 projects');
        expect(projectsLink.closest('a')).toHaveAttribute(
            'href',
            '/projects?area=areauid1'
        );
    });
});
