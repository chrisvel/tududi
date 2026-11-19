import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    MemoryRouter,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import KanbanBoard from '../components/Kanban/KanbanBoard';
import EisenhowerMatrix from '../components/Eisenhower/EisenhowerMatrix';
import {
    EMPTY_SCOPE,
    parseBoardScope,
    scopeTaskQueries,
    taskPriority,
} from '../components/Boards/useBoardScope';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, options?: any) =>
            (fallback ?? key).replace(
                /\{\{(\w+)\}\}/g,
                (_: string, name: string) => options?.[name] ?? ''
            ),
    }),
}));

jest.mock('../components/Task/TaskItem', () => ({
    __esModule: true,
    default: ({ task }: any) => <div data-testid="task">{task.name}</div>,
}));

// a1 "Pas a pas" holds Website (p1) and the closed Archive (p3); a2 "Ops"
// holds Backend (p2). Shaped as GET /api/projects returns them: area_id and
// the Area association, no area_uid.
const storeState = {
    projectsStore: {
        projects: [
            {
                id: 1,
                uid: 'p1',
                name: 'Website',
                area_id: 1,
                Area: { id: 1, uid: 'a1', name: 'Pas a pas' },
            },
            {
                id: 2,
                uid: 'p2',
                name: 'Backend',
                area_id: 2,
                Area: { id: 2, uid: 'a2', name: 'Ops' },
            },
            {
                id: 3,
                uid: 'p3',
                name: 'Archive',
                area_id: 1,
                Area: { id: 1, uid: 'a1', name: 'Pas a pas' },
                status: 'done',
            },
        ],
    },
    areasStore: {
        areas: [
            { id: 1, uid: 'a1', name: 'Pas a pas' },
            { id: 2, uid: 'a2', name: 'Ops' },
        ],
    },
    tagsStore: {
        tags: [
            { id: 1, name: 'urgent' },
            { id: 2, name: 'client' },
        ],
        hasLoaded: true,
        loadTags: jest.fn(),
    },
};

jest.mock('../store/useStore', () => {
    const mockUseStore: any = (selector?: any) =>
        selector ? selector(storeState) : storeState;
    mockUseStore.getState = () => storeState;
    return { useStore: mockUseStore };
});

const task = (
    id: number,
    name: string,
    priority: number | null,
    tags: string[]
) => ({
    id,
    uid: `t${id}`,
    name,
    status: 'not_started',
    priority,
    tags: tags.map((tagName) => ({ name: tagName })),
});
const WEBSITE = task(1, 'Website task', 2, ['urgent', 'client']);
const BACKEND = task(2, 'Backend task', null, ['urgent']);
const LOOSE = task(3, 'Loose task', 0, []);

// What GET /api/tasks returns per scope; an unknown UID matches nothing,
// as scopeService does.
const TASKS: Record<string, any[]> = {
    all: [WEBSITE, BACKEND, LOOSE],
    p1: [WEBSITE],
    p2: [BACKEND],
    a1: [WEBSITE],
    // Both areas list the Website task, to check merging drops duplicates.
    a2: [BACKEND, WEBSITE],
};
const NAMES: Record<string, string> = {
    p1: 'Website',
    p2: 'Backend',
    a1: 'Pas a pas',
    a2: 'Ops',
};

const json = (body: unknown, status = 200) =>
    Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response);

const defaultFetch = (url: string) => {
    const lookup = url.match(/\/(?:project|areas)\/([^/?]+)$/);
    if (lookup) {
        const uid = decodeURIComponent(lookup[1]);
        return NAMES[uid] ? json({ uid, name: NAMES[uid] }) : json({}, 404);
    }
    if (url.includes('tasks?')) {
        const scoped = url.match(/(?:project_uid|area_uid)=([^&]+)/);
        const key = scoped ? decodeURIComponent(scoped[1]) : 'all';
        // tags=a,b keeps the tasks carrying all of them; an unknown tag
        // therefore matches nothing, as scopeService does.
        const tagParam = url.match(/[?&]tags=([^&]+)/);
        const wanted = tagParam
            ? decodeURIComponent(tagParam[1]).split(',')
            : [];
        const tasks = (TASKS[key] ?? []).filter((t) =>
            wanted.every((name) => t.tags.some((tag: any) => tag.name === name))
        );
        return json({ tasks });
    }
    return json({}, 404);
};

const fetchMock = jest.fn(defaultFetch);

const taskUrls = () =>
    fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('tasks?'));

const Nav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    return (
        <div>
            <span data-testid="location">
                {decodeURIComponent(location.search)}
            </span>
            <button onClick={() => navigate('/boards/kanban?project=p2')}>
                go-p2
            </button>
            <button onClick={() => navigate(-1)}>back</button>
            <button onClick={() => navigate(1)}>forward</button>
        </div>
    );
};

const renderKanban = (url: string) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route
                    path="/boards/kanban"
                    element={
                        <>
                            <KanbanBoard />
                            <Nav />
                        </>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

const shownTasks = () =>
    screen
        .queryAllByTestId('task')
        .map((el) => el.textContent)
        .sort();
const location = () => screen.getByTestId('location').textContent;
const chips = () =>
    within(screen.getByRole('list', { name: 'Active filters' }))
        .queryAllByRole('listitem')
        .map((el) => el.textContent);
const openMenu = (name: 'Areas' | 'Projects' | 'Tags' | 'Priority') => {
    fireEvent.click(screen.getByRole('button', { name }));
    return screen.getByRole('listbox', { name });
};
const optionLabels = (menu: HTMLElement) =>
    within(menu)
        .queryAllByRole('option')
        .map((el) => el.textContent);

describe('board scope filter', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockImplementation(defaultFetch);
        (global as any).fetch = fetchMock;
        localStorage.clear();
    });

    it('parses comma-separated UIDs and lets projects define the queries', () => {
        expect(
            parseBoardScope(
                new URLSearchParams(
                    'area=a1,a2,a1&project=%20&tags=urgent&priority=high,none'
                )
            )
        ).toEqual({
            areaUids: ['a1', 'a2'],
            projectUids: [],
            tags: ['urgent'],
            priorities: ['high', 'none'],
        });
        expect(scopeTaskQueries(EMPTY_SCOPE)).toEqual(['']);
        expect(
            scopeTaskQueries({
                ...EMPTY_SCOPE,
                areaUids: ['a1'],
                projectUids: ['p1', 'p2'],
            })
        ).toEqual(['&project_uid=p1', '&project_uid=p2']);
        expect(
            scopeTaskQueries({
                ...EMPTY_SCOPE,
                areaUids: ['a1', 'bad/uid'],
                tags: ['urgent', 'a b'],
            })
        ).toEqual(['&area_uid=a1&tags=urgent%2Ca%20b']);
        expect(scopeTaskQueries({ ...EMPTY_SCOPE, tags: ['urgent'] })).toEqual([
            '&tags=urgent',
        ]);
        // Only malformed UIDs: no request at all, never an unscoped one.
        expect(
            scopeTaskQueries({ ...EMPTY_SCOPE, projectUids: ['../x'] })
        ).toEqual([]);
    });

    it('shows only the project tasks when opened from a direct project URL', async () => {
        renderKanban('/boards/kanban?project=p1');

        await waitFor(() => expect(shownTasks()).toEqual(['Website task']));
        expect(taskUrls()).toEqual([
            expect.stringContaining('&project_uid=p1'),
        ]);
        expect(chips()).toEqual(['ProjectWebsite']);
    });

    it('merges several projects, and an area with its picked projects', async () => {
        renderKanban('/boards/kanban?area=a1&project=p1,p2');

        await waitFor(() =>
            expect(shownTasks()).toEqual(['Backend task', 'Website task'])
        );
        // Picked projects define the board: no area request.
        expect(taskUrls()).toEqual([
            expect.stringContaining('&project_uid=p1'),
            expect.stringContaining('&project_uid=p2'),
        ]);
        expect(chips()).toEqual([
            'AreaPas a pas',
            'ProjectWebsite',
            'ProjectBackend',
        ]);
    });

    it('drops tasks listed by two scopes', async () => {
        renderKanban('/boards/kanban?area=a1,a2');

        await waitFor(() =>
            expect(shownTasks()).toEqual(['Backend task', 'Website task'])
        );
        expect(taskUrls()).toHaveLength(2);
    });

    it('picks projects from a searchable menu that stays open', async () => {
        renderKanban('/boards/kanban');
        await waitFor(() => expect(shownTasks()).toHaveLength(3));
        expect(taskUrls()[0]).not.toMatch(/project_uid|area_uid/);

        const menu = openMenu('Projects');
        // The closed project is not offered.
        expect(optionLabels(menu)).toEqual(['Backend', 'Website']);
        fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
            target: { value: 'web' },
        });
        expect(optionLabels(menu)).toEqual(['Website']);
        fireEvent.click(within(menu).getByRole('checkbox'));
        await waitFor(() => expect(location()).toBe('?project=p1'));

        fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
            target: { value: '' },
        });
        fireEvent.click(
            within(menu)
                .getByRole('option', { name: 'Backend' })
                .querySelector('input')!
        );
        await waitFor(() => expect(location()).toBe('?project=p1,p2'));
        await waitFor(() =>
            expect(shownTasks()).toEqual(['Backend task', 'Website task'])
        );
    });

    it('limits the project menu to the picked areas and drops projects outside them', async () => {
        renderKanban('/boards/kanban?project=p1,p2');
        await waitFor(() => expect(shownTasks()).toHaveLength(2));

        const areas = openMenu('Areas');
        fireEvent.click(
            within(areas)
                .getByRole('option', { name: 'Ops' })
                .querySelector('input')!
        );
        // Website sits in another area: it leaves the selection.
        await waitFor(() => expect(location()).toBe('?area=a2&project=p2'));

        fireEvent.mouseDown(document.body);
        const projects = openMenu('Projects');
        expect(optionLabels(projects)).toEqual(['Backend']);
    });

    it('removes one filter from its chip, then clears them all', async () => {
        renderKanban('/boards/kanban?area=a1&project=p1,p2');
        await waitFor(() => expect(chips()).toHaveLength(3));

        fireEvent.click(
            screen.getByRole('button', { name: 'Remove filter Website' })
        );
        await waitFor(() => expect(location()).toBe('?area=a1&project=p2'));
        await waitFor(() => expect(shownTasks()).toEqual(['Backend task']));

        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        await waitFor(() => expect(location()).toBe(''));
        await waitFor(() => expect(shownTasks()).toHaveLength(3));
        expect(taskUrls().at(-1)).not.toMatch(/project_uid|area_uid/);
    });

    it('refetches when the scope changes without remounting, including Back and Forward', async () => {
        renderKanban('/boards/kanban?project=p1');
        await waitFor(() => expect(shownTasks()).toEqual(['Website task']));

        fireEvent.click(screen.getByText('go-p2'));
        await waitFor(() => expect(shownTasks()).toEqual(['Backend task']));

        fireEvent.click(screen.getByText('back'));
        await waitFor(() => expect(shownTasks()).toEqual(['Website task']));

        fireEvent.click(screen.getByText('forward'));
        await waitFor(() => expect(shownTasks()).toEqual(['Backend task']));

        expect(taskUrls()).toEqual([
            expect.stringContaining('project_uid=p1'),
            expect.stringContaining('project_uid=p2'),
            expect.stringContaining('project_uid=p1'),
            expect.stringContaining('project_uid=p2'),
        ]);
    });

    it('marks an unknown project and never asks for unscoped tasks', async () => {
        renderKanban('/boards/kanban?project=gone');

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'not shared with you'
        );
        expect(chips()).toEqual(['Projectgone']);
        await act(async () => {});
        expect(taskUrls()).toEqual([
            expect.stringContaining('&project_uid=gone'),
        ]);
        expect(shownTasks()).toEqual([]);
    });

    it('rejects a malformed UID without any request', async () => {
        renderKanban('/boards/kanban?project=..%2Fsecret');

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        await act(async () => {});
        expect(fetchMock).not.toHaveBeenCalled();
        expect(shownTasks()).toEqual([]);
    });

    it('ignores a task response that arrives after the scope changed', async () => {
        let releaseFirst: () => void = () => {};
        fetchMock.mockImplementation((url: string) => {
            if (url.includes('project_uid=p1')) {
                return new Promise<Response>((resolve) => {
                    releaseFirst = () =>
                        resolve(json({ tasks: TASKS.p1 }) as any);
                }) as any;
            }
            return defaultFetch(url);
        });

        renderKanban('/boards/kanban?project=p1');
        fireEvent.click(screen.getByText('go-p2'));
        await waitFor(() => expect(shownTasks()).toEqual(['Backend task']));

        await act(async () => releaseFirst());
        expect(shownTasks()).toEqual(['Backend task']);
    });

    it('keeps the tasks carrying all the picked tags, within the scope', async () => {
        renderKanban('/boards/kanban?project=p1,p2&tags=urgent,client');

        await waitFor(() => expect(shownTasks()).toEqual(['Website task']));
        expect(taskUrls()).toEqual([
            expect.stringContaining('&project_uid=p1&tags=urgent%2Cclient'),
            expect.stringContaining('&project_uid=p2&tags=urgent%2Cclient'),
        ]);
        expect(chips()).toEqual([
            'ProjectWebsite',
            'ProjectBackend',
            'Tag#urgent',
            'Tag#client',
        ]);
    });

    it('picks tags from their menu', async () => {
        renderKanban('/boards/kanban');
        await waitFor(() => expect(shownTasks()).toHaveLength(3));

        const menu = openMenu('Tags');
        expect(optionLabels(menu)).toEqual(['#client', '#urgent']);
        fireEvent.click(
            within(menu)
                .getByRole('option', { name: '#urgent' })
                .querySelector('input')!
        );
        await waitFor(() => expect(location()).toBe('?tags=urgent'));
        await waitFor(() =>
            expect(shownTasks()).toEqual(['Backend task', 'Website task'])
        );
        expect(taskUrls().at(-1)).toContain('&tags=urgent');
    });

    it('marks an unknown tag, which matches no task', async () => {
        renderKanban('/boards/kanban?tags=gone');

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(chips()).toEqual(['Tag#gone']);
        await act(async () => {});
        expect(shownTasks()).toEqual([]);
    });

    it('keeps the picked priorities, "none" included, and ignores unknown ones', async () => {
        renderKanban('/boards/kanban?priority=high,none,urgent');

        await waitFor(() =>
            expect(shownTasks()).toEqual(['Backend task', 'Website task'])
        );
        // Filtered in the page: the request itself is unscoped.
        expect(taskUrls()).toEqual([
            expect.not.stringMatching(/priority|project_uid|area_uid|tags/),
        ]);
        expect(chips()).toEqual([
            'PriorityHigh',
            'PriorityNone',
            'Priorityurgent',
        ]);
        expect(screen.getByRole('alert')).toBeInTheDocument();

        const menu = openMenu('Priority');
        fireEvent.click(
            within(menu)
                .getByRole('option', { name: 'Low' })
                .querySelector('input')!
        );
        await waitFor(() =>
            expect(location()).toBe('?priority=high,none,urgent,low')
        );
        await waitFor(() => expect(shownTasks()).toHaveLength(3));
    });

    it('reads task priorities given as numbers or names', () => {
        expect(taskPriority({ priority: 2 as any })).toBe('high');
        expect(taskPriority({ priority: 'medium' })).toBe('medium');
        expect(taskPriority({ priority: 0 as any })).toBe('low');
        expect(taskPriority({ priority: null })).toBe('none');
    });

    it('narrows the Eisenhower matrix to an area', async () => {
        render(
            <MemoryRouter initialEntries={['/boards/eisenhower?area=a1']}>
                <Routes>
                    <Route
                        path="/boards/eisenhower"
                        element={<EisenhowerMatrix />}
                    />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => expect(taskUrls()).toHaveLength(1));
        expect(taskUrls()[0]).toContain('status=active');
        expect(taskUrls()[0]).toContain('&area_uid=a1');
        expect(await screen.findByText('Pas a pas')).toBeInTheDocument();
    });
});
