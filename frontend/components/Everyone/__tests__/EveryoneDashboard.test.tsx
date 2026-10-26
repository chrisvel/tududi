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

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { t: (key: string) => key, language: 'en' },
}));

const fetchEveryone = jest.fn();
jest.mock('../../../utils/everyoneService', () => {
    const actual = jest.requireActual('../../../utils/everyoneService');
    return {
        ...actual,
        fetchEveryone: (...a: any[]) => fetchEveryone(...a),
    };
});

jest.mock('../../../utils/groupsService', () => ({
    fetchGroups: () => Promise.resolve([]),
}));

const toggleTaskCompletion = jest.fn();
const updateTask = jest.fn();
jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: (...a: any[]) => toggleTaskCompletion(...a),
    updateTask: (...a: any[]) => updateTask(...a),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast: jest.fn() }),
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
        toggleTaskCompletion.mockReset();
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
                    today: [
                        {
                            uid: 't2',
                            name: 'Mate task',
                            status: 0,
                            Project: { name: 'Garden' },
                        },
                    ],
                },
            ],
        });

        renderPage();

        await waitFor(() =>
            expect(screen.getByText('Owner task')).toBeInTheDocument()
        );
        expect(screen.getByText('Garden')).toBeInTheDocument();
        expect(screen.getByText('Mate task')).toBeInTheDocument();
        expect(screen.getByText('Mate')).toBeInTheDocument();
        expect(screen.getByText('You')).toBeInTheDocument();
        // Your own column names you under "You".
        expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    it('gives people without a colour different colours', async () => {
        fetchEveryone.mockResolvedValue({
            summary,
            columns: [
                column({}),
                column({
                    person: { ...column({}).person, uid: 'p2', name: 'Other' },
                }),
            ],
        });
        renderPage();

        const first = await screen.findByTestId('person-column-p1');
        const second = screen.getByTestId('person-column-p2');
        const strip = (el: HTMLElement) =>
            (el.firstElementChild as HTMLElement).style.backgroundColor;
        expect(strip(first)).not.toBe('');
        expect(strip(first)).not.toBe(strip(second));
    });

    it('drops a task from the board when its done circle is clicked', async () => {
        toggleTaskCompletion.mockImplementation(
            async (_uid: string, task: any) => ({
                ...task,
                status: 'done',
            })
        );
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
            screen.getByRole('button', { name: 'Mark as done' })
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
