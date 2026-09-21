import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '../../Sidebar';
import { useStore } from '../../../store/useStore';

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/today', search: '' }),
}));

function mockStub(testId: string) {
    const Stub = () => <div data-testid={testId} />;
    return Stub;
}

jest.mock('../SidebarNav', () => ({
    __esModule: true,
    default: mockStub('nav'),
}));
jest.mock('../SidebarFooter', () => ({
    __esModule: true,
    default: mockStub('footer'),
}));
jest.mock('../SidebarAdmin', () => ({
    __esModule: true,
    default: mockStub('admin'),
}));
jest.mock('../SidebarBookmarks', () => ({
    __esModule: true,
    default: mockStub('favorites'),
}));
jest.mock('../SidebarProjects', () => ({
    __esModule: true,
    default: mockStub('projects'),
}));
jest.mock('../SidebarAreas', () => ({
    __esModule: true,
    default: mockStub('areas'),
}));
jest.mock('../SidebarGoals', () => ({
    __esModule: true,
    default: mockStub('goals'),
}));
jest.mock('../SidebarNotes', () => ({
    __esModule: true,
    default: mockStub('notes'),
}));
jest.mock('../SidebarTags', () => ({
    __esModule: true,
    default: mockStub('tags'),
}));
jest.mock('../SidebarPeople', () => ({
    __esModule: true,
    default: mockStub('people'),
}));
jest.mock('../SidebarHabits', () => ({
    __esModule: true,
    default: mockStub('habits'),
}));
jest.mock('../SidebarViews', () => ({
    __esModule: true,
    default: mockStub('views'),
}));
jest.mock('../SidebarBoards', () => ({
    __esModule: true,
    default: mockStub('boards'),
}));
jest.mock('../SidebarInsights', () => ({
    __esModule: true,
    default: mockStub('insights'),
}));

const sections = [
    'favorites',
    'projects',
    'areas',
    'goals',
    'notes',
    'tags',
    'people',
    'habits',
    'views',
    'boards',
    'insights',
];

const renderSidebar = () =>
    render(
        <Sidebar
            isSidebarOpen
            setIsSidebarOpen={jest.fn()}
            currentUser={{ email: 'test@example.com' }}
            isDarkMode={false}
            toggleDarkMode={jest.fn()}
            openTaskModal={jest.fn()}
            openProjectModal={jest.fn()}
            onCreateNote={jest.fn()}
            openAreaModal={jest.fn()}
            openTagModal={jest.fn()}
            openPersonModal={jest.fn()}
            openNewHabit={jest.fn()}
            notes={[]}
            areas={[]}
            tags={[]}
        />
    );

const setVisibleSections = (visible: Record<string, boolean>) =>
    act(() => {
        useStore
            .getState()
            .userSettingsStore.setSidebarVisibleSections(visible);
    });

describe('Sidebar section visibility', () => {
    beforeEach(() => {
        act(() => {
            useStore.setState((state: any) => ({
                userSettingsStore: {
                    ...state.userSettingsStore,
                    habitsEnabled: true,
                },
            }));
        });
        setVisibleSections({});
    });

    it('shows every section when nothing has been turned off', () => {
        renderSidebar();

        for (const id of sections) {
            expect(screen.getByTestId(id)).toBeInTheDocument();
        }
    });

    it.each(sections)('hides %s when it is turned off', (id) => {
        setVisibleSections({ [id]: false });

        renderSidebar();

        expect(screen.queryByTestId(id)).toBeNull();
        for (const other of sections.filter((s) => s !== id)) {
            expect(screen.getByTestId(other)).toBeInTheDocument();
        }
    });

    it('keeps habits hidden when the habits feature is off', () => {
        act(() => {
            useStore.setState((state: any) => ({
                userSettingsStore: {
                    ...state.userSettingsStore,
                    habitsEnabled: false,
                },
            }));
        });

        renderSidebar();

        expect(screen.queryByTestId('habits')).toBeNull();
    });
});
