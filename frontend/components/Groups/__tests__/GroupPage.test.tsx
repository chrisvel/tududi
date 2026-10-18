import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupPage from '../GroupPage';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const fetchGroupPage = jest.fn();
jest.mock('../../../utils/groupsService', () => ({
    fetchGroupPage: (...a: any[]) => fetchGroupPage(...a),
}));

jest.mock('../../../utils/projectsService', () => ({
    fetchProjects: () => Promise.resolve([]),
}));

jest.mock('../../Task/TaskList', () => ({
    __esModule: true,
    default: ({ tasks }: any) => (
        <ul>
            {tasks.map((task: any) => (
                <li key={task.uid}>{task.name}</li>
            ))}
        </ul>
    ),
}));

const empty = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    no_date: [],
};
const counts = { overdue: 0, today: 0, tomorrow: 0, upcoming: 0, no_date: 0 };

const column = (uid: string, name: string, extra: any = {}) => ({
    person: {
        uid,
        name,
        color: null,
        relationship_type: null,
        linked_user_id: 1,
    },
    is_self: false,
    counts,
    ...empty,
    ...extra,
});

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/groups/g1']}>
            <Routes>
                <Route path="/groups/:uid" element={<GroupPage />} />
            </Routes>
        </MemoryRouter>
    );

describe('GroupPage', () => {
    beforeEach(() => fetchGroupPage.mockReset());

    it('shows the group name and a column per member with their tasks', async () => {
        fetchGroupPage.mockResolvedValue({
            group: {
                uid: 'g1',
                name: 'Family',
                description: null,
                member_count: 2,
            },
            columns: [
                column('p1', 'Alice'),
                column('p2', 'Bob', {
                    counts: { ...counts, today: 1 },
                    today: [{ uid: 't1', name: 'Feed the cat' }],
                }),
            ],
            summary: { people: 2, total: 1, overdue: 0, today: 1 },
        });

        renderPage();

        expect(
            await screen.findByRole('heading', { name: 'Family' })
        ).toBeInTheDocument();
        expect(fetchGroupPage).toHaveBeenCalledWith('g1');
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Feed the cat')).toBeInTheDocument();
    });

    it('shows the load error', async () => {
        fetchGroupPage.mockRejectedValue(new Error('Group not found'));
        renderPage();
        expect(await screen.findByText('Group not found')).toBeInTheDocument();
    });
});
