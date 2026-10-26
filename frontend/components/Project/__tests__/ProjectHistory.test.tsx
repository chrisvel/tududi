import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ProjectHistory, { groupByFinish } from '../ProjectHistory';
import { ToastProvider } from '../../Shared/ToastContext';
import { Project } from '../../../entities/Project';

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: {},
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

const projects: Project[] = [
    {
        uid: 'p-old',
        name: 'Garden shed',
        status: 'done',
        created_at: '2025-03-01T10:00:00Z',
        completed_at: '2025-11-20T10:00:00Z',
    },
    {
        uid: 'p-new',
        name: 'Tax return',
        status: 'done',
        created_at: '2026-09-01T10:00:00Z',
        completed_at: '2026-10-05T10:00:00Z',
    },
    {
        uid: 'p-sep',
        name: 'Move house',
        status: 'done',
        completed_at: '2026-09-12T10:00:00Z',
    },
    {
        uid: 'p-cancel',
        name: 'Learn oboe',
        status: 'cancelled',
        updated_at: '2026-10-01T10:00:00Z',
    },
    { uid: 'p-open', name: 'Still going', status: 'in_progress' },
];

const mockSetProjects = jest.fn();
const mockUpdateProject = jest.fn();

jest.mock('../../../utils/projectsService', () => ({
    fetchProjects: jest.fn(() => Promise.resolve(projects)),
    updateProject: (...args: any[]) => mockUpdateProject(...args),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) =>
        selector({
            projectsStore: {
                projects,
                hasLoaded: true,
                setProjects: mockSetProjects,
            },
        }),
}));

const renderPage = () =>
    render(
        <ToastProvider>
            <MemoryRouter>
                <ProjectHistory />
            </MemoryRouter>
        </ToastProvider>
    );

describe('groupByFinish', () => {
    it('groups newest first by year, then month', () => {
        const years = groupByFinish(
            projects.filter((p) => p.status === 'done')
        );

        expect(years.map((y) => y.year)).toEqual([2026, 2025]);
        expect(years[0].count).toBe(2);
        expect(years[0].months.map((m) => m.projects[0].uid)).toEqual([
            'p-new',
            'p-sep',
        ]);
        expect(years[1].months[0].projects[0].uid).toBe('p-old');
    });
});

describe('ProjectHistory', () => {
    beforeEach(() => {
        localStorage.clear();
        mockUpdateProject.mockReset();
        mockSetProjects.mockReset();
    });

    it('lists done projects and hides cancelled ones until asked', async () => {
        renderPage();

        expect(await screen.findByText('Tax return')).toBeInTheDocument();
        expect(screen.getByText('Garden shed')).toBeInTheDocument();
        expect(screen.queryByText('Still going')).not.toBeInTheDocument();
        expect(screen.queryByText('Learn oboe')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('history-show-cancelled'));

        expect(screen.getByText('Learn oboe')).toBeInTheDocument();
    });

    it('reopens a project back to in progress', async () => {
        mockUpdateProject.mockResolvedValue({
            uid: 'p-new',
            name: 'Tax return',
            status: 'in_progress',
            completed_at: null,
        });
        renderPage();

        fireEvent.click(await screen.findByTestId('history-reopen-p-new'));

        await waitFor(() =>
            expect(mockUpdateProject).toHaveBeenCalledWith('p-new', {
                status: 'in_progress',
            })
        );
        await waitFor(() => expect(mockSetProjects).toHaveBeenCalled());
    });
});
