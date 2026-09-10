import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

jest.mock('../../Task/TaskList', () => ({
    __esModule: true,
    default: ({ tasks }: { tasks: any[] }) => (
        <ul>
            {tasks.map((t) => (
                <li key={t.uid}>{t.name}</li>
            ))}
        </ul>
    ),
}));

const emptyBuckets = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    no_date: [],
};

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
    beforeEach(() => fetchEveryone.mockReset());

    it('renders a column per person with their tasks', async () => {
        fetchEveryone.mockResolvedValue({
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

    it('shows the empty state when nothing is on', async () => {
        fetchEveryone.mockResolvedValue({ columns: [] });
        renderPage();
        await waitFor(() =>
            expect(
                screen.getByText(/Nothing shared is on right now/)
            ).toBeInTheDocument()
        );
    });
});
