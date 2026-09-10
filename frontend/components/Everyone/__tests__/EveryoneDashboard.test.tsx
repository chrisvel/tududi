import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import EveryoneDashboard from '../EveryoneDashboard';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const fetchEveryone = jest.fn();
jest.mock('../../../utils/everyoneService', () => {
    const actual = jest.requireActual('../../../utils/everyoneService');
    return {
        ...actual,
        fetchEveryone: (...a: any[]) => fetchEveryone(...a),
    };
});

jest.mock('../../../utils/projectsService', () => ({
    fetchProjects: () => Promise.resolve([]),
}));

const toggleTaskCompletion = jest.fn().mockResolvedValue({});
jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: (...a: any[]) => toggleTaskCompletion(...a),
}));

const emptyBuckets = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    no_date: [],
};

const summary = { people: 1, total: 0, overdue: 0, today: 0 };

const column = (over: any) => ({
    ...emptyBuckets,
    counts: { overdue: 0, today: 0, tomorrow: 0, upcoming: 0, no_date: 0 },
    is_self: false,
    person: {
        uid: 'p1',
        name: 'Mate',
        color: null,
        relationship_type: 'family',
        linked_user_id: 2,
    },
    ...over,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <EveryoneDashboard />
        </MemoryRouter>
    );

describe('EveryoneDashboard', () => {
    beforeEach(() => {
        fetchEveryone.mockReset();
        toggleTaskCompletion.mockClear();
    });

    it('renders a column per person with their tasks', async () => {
        fetchEveryone.mockResolvedValue({
            summary,
            columns: [
                {
                    ...column({}),
                    is_self: true,
                    person: { ...column({}).person, uid: 'me', name: 'Owner' },
                    today: [{ uid: 't1', name: 'Owner task', status: 0 }],
                },
                {
                    ...column({}),
                    today: [{ uid: 't2', name: 'Mate task', status: 0 }],
                },
            ],
        });

        renderPage();

        await waitFor(() =>
            expect(screen.getByText('Owner task')).toBeInTheDocument()
        );
        expect(screen.getByText('Mate task')).toBeInTheDocument();
        expect(screen.getByText('Mate')).toBeInTheDocument();
        expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('completes a task from its row and drops it from the board', async () => {
        fetchEveryone
            .mockResolvedValueOnce({
                summary,
                columns: [
                    {
                        ...column({}),
                        today: [{ uid: 't2', name: 'Mate task', status: 0 }],
                    },
                ],
            })
            .mockResolvedValue({ summary, columns: [column({})] });

        renderPage();
        await waitFor(() =>
            expect(screen.getByText('Mate task')).toBeInTheDocument()
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Mark complete' })
        );

        expect(toggleTaskCompletion).toHaveBeenCalledWith(
            't2',
            expect.objectContaining({ uid: 't2' })
        );
        await waitFor(() =>
            expect(screen.queryByText('Mate task')).not.toBeInTheDocument()
        );
    });

    it('shows the empty state when nothing is on', async () => {
        fetchEveryone.mockResolvedValue({
            summary: { people: 0, total: 0, overdue: 0, today: 0 },
            columns: [],
        });
        renderPage();
        await waitFor(() =>
            expect(
                screen.getByText(/Nothing shared is on right now/)
            ).toBeInTheDocument()
        );
    });

    it('renders the stats row from the summary', async () => {
        fetchEveryone.mockResolvedValue({
            summary: { people: 3, total: 7, overdue: 2, today: 4 },
            columns: [column({})],
        });
        renderPage();

        await waitFor(() =>
            expect(screen.getByText('People')).toBeInTheDocument()
        );
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Overdue')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
    });
});
