import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Layout from '../Layout';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../components/Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: '/areas', search: '' }),
    useNavigate: () => jest.fn(),
}));

jest.mock('../components/Navbar', () => ({
    __esModule: true,
    default: () => <div data-testid="navbar" />,
}));

jest.mock('../components/Sidebar', () => ({
    __esModule: true,
    default: () => <div data-testid="sidebar" />,
}));

jest.mock('../components/Project/ProjectModal', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../components/Note/NoteModal', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../components/Area/AreaModal', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../components/Tag/TagModal', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../components/People/PersonModal', () => ({
    __esModule: true,
    default: () => null,
}));

const baseStoreState: any = {
    notesStore: {
        notes: [],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        loadNotes: jest.fn(),
        setNotes: jest.fn(),
    },
    areasStore: {
        areas: [],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        loadAreas: jest.fn(),
        setAreas: jest.fn(),
    },
    tasksStore: {
        tasks: [],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        createTask: jest.fn(),
    },
    projectsStore: {
        // Non-empty so Layout's own "load projects if empty" effect doesn't
        // fire a real fetch during these tests.
        projects: [{ id: 1, uid: 'p1', name: 'Project 1' }],
        setProjects: jest.fn(),
        isLoading: false,
        isError: false,
        hasLoaded: true,
    },
    tagsStore: {
        tags: [],
        isLoading: false,
        isError: false,
        hasLoaded: true,
        setTags: jest.fn(),
    },
    peopleStore: {
        people: [],
    },
};

let storeState: any = baseStoreState;

jest.mock('../store/useStore', () => {
    const mockUseStore: any = () => storeState;
    mockUseStore.getState = () => storeState;
    return { useStore: mockUseStore };
});

const renderLayout = () =>
    render(
        <Layout
            currentUser={{ email: 'user@example.com' } as any}
            setCurrentUser={jest.fn()}
            isDarkMode={false}
            toggleDarkMode={jest.fn()}
        >
            <div data-testid="routed-page">Areas page content</div>
        </Layout>
    );

describe('Layout loading gate', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
        }) as any;
        storeState = baseStoreState;
    });

    it('renders the routed page once every store has loaded at least once', () => {
        renderLayout();

        expect(screen.getByTestId('routed-page')).toBeInTheDocument();
    });

    it('does not swap the routed page out for the full-screen loader when a store that has already loaded starts a background refresh', () => {
        // Mirrors Areas.tsx calling loadAreas(true) on every mount: areasStore
        // goes back into isLoading even though hasLoaded is already true.
        storeState = {
            ...baseStoreState,
            areasStore: {
                ...baseStoreState.areasStore,
                isLoading: true,
                hasLoaded: true,
            },
        };

        renderLayout();

        // Regression guard for #1427: if Layout unmounted the routed page
        // here, the page's mount effect would refire its forced reload,
        // looping forever.
        expect(screen.getByTestId('routed-page')).toBeInTheDocument();
        expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });

    it('still shows the full-screen loader while a store has not loaded for the first time yet', () => {
        storeState = {
            ...baseStoreState,
            areasStore: {
                ...baseStoreState.areasStore,
                isLoading: true,
                hasLoaded: false,
            },
        };

        renderLayout();

        expect(screen.queryByTestId('routed-page')).not.toBeInTheDocument();
    });

    it('does not swap the routed page out when tasksStore refetches after it has already loaded', () => {
        // Mirrors ProductivityPage.tsx calling loadTasks() on mount: tasksStore
        // goes back into isLoading even though hasLoaded is already true.
        storeState = {
            ...baseStoreState,
            tasksStore: {
                ...baseStoreState.tasksStore,
                isLoading: true,
                hasLoaded: true,
            },
        };

        renderLayout();

        // Regression guard for #1410: if Layout unmounted the routed page
        // here, ProductivityPage's mount effect would refire loadTasks(),
        // looping forever when the user has zero tasks.
        expect(screen.getByTestId('routed-page')).toBeInTheDocument();
        expect(screen.queryByText('common.loading')).not.toBeInTheDocument();
    });
});
