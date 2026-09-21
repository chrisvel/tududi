import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarNav from '../SidebarNav';
import SidebarAdmin from '../SidebarAdmin';
import { useStore } from '../../../store/useStore';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../utils/inboxService', () => ({
    loadInboxItemsToStore: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/featureFlags', () => ({
    getFeatureFlags: jest.fn().mockResolvedValue({ hosted: false }),
}));

const location = {
    pathname: '/today',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

const setSettings = (
    settings: Record<string, boolean>,
    visible: Record<string, boolean> = {}
) =>
    act(() => {
        useStore.setState((state: any) => ({
            userSettingsStore: {
                ...state.userSettingsStore,
                ...settings,
                sidebarVisibleSections: visible,
            },
        }));
    });

describe('SidebarNav calendar visibility', () => {
    const renderNav = () =>
        render(
            <SidebarNav
                handleNavClick={jest.fn()}
                location={location}
                isDarkMode={false}
                openTaskModal={jest.fn()}
            />
        );

    it('shows Calendar when the feature is on and it is not hidden', () => {
        setSettings({ calendarEnabled: true });

        renderNav();

        expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    it('hides Calendar when it is turned off in the sidebar settings', () => {
        setSettings({ calendarEnabled: true }, { calendar: false });

        renderNav();

        expect(screen.queryByText('Calendar')).toBeNull();
    });

    it('hides Calendar when the feature is off', () => {
        setSettings({ calendarEnabled: false });

        renderNav();

        expect(screen.queryByText('Calendar')).toBeNull();
    });
});

describe('SidebarNav link order and visibility', () => {
    const renderNav = () =>
        render(
            <SidebarNav
                handleNavClick={jest.fn()}
                location={location}
                isDarkMode={false}
                openTaskModal={jest.fn()}
            />
        );

    const renderedLinks = () =>
        screen
            .getAllByTestId(/^sidebar-nav-/)
            .map((el) => el.getAttribute('data-testid'));

    afterEach(() => {
        act(() => {
            useStore.getState().userSettingsStore.setSidebarOrder({});
        });
    });

    it('shows the links in the default order', () => {
        setSettings({ calendarEnabled: true, hasCollaborators: true });

        renderNav();

        expect(renderedLinks()).toEqual([
            'sidebar-nav-inbox',
            'sidebar-nav-today',
            'sidebar-nav-upcoming',
            'sidebar-nav-calendar',
            'sidebar-nav-tasks',
            'sidebar-nav-tasks',
            'sidebar-nav-everyone',
        ]);
    });

    it('shows the links in the saved order', () => {
        setSettings({ calendarEnabled: true, hasCollaborators: false });
        act(() => {
            useStore.getState().userSettingsStore.setSidebarOrder({
                linkOrder: ['allTasks', 'today', 'inbox'],
            });
        });

        renderNav();

        expect(renderedLinks().slice(0, 3)).toEqual([
            'sidebar-nav-tasks',
            'sidebar-nav-today',
            'sidebar-nav-inbox',
        ]);
    });

    it.each([
        ['inbox', 'Inbox'],
        ['today', 'Today'],
        ['allTasks', 'All Tasks'],
        ['upcomingTasks', 'Upcoming'],
        ['assignedToMe', 'Assigned to me'],
    ])('hides %s when it is turned off', (key, label) => {
        setSettings({ calendarEnabled: true }, { [key]: false });

        renderNav();

        expect(screen.queryByText(label)).toBeNull();
    });
});

describe('SidebarAdmin templates and access visibility', () => {
    const renderAdmin = (isAdmin: boolean) =>
        render(
            <SidebarAdmin
                handleNavClick={jest.fn()}
                location={location}
                currentUser={{ is_admin: isAdmin }}
            />
        );

    it('shows Templates and Access to an admin by default', () => {
        setSettings({ templatesEnabled: true });

        renderAdmin(true);

        expect(screen.getByText('Templates')).toBeInTheDocument();
        expect(screen.getByText('Access')).toBeInTheDocument();
    });

    it('hides Templates when it is turned off', () => {
        setSettings({ templatesEnabled: true }, { templates: false });

        renderAdmin(true);

        expect(screen.queryByText('Templates')).toBeNull();
        expect(screen.getByText('Access')).toBeInTheDocument();
    });

    it('hides Access when it is turned off', () => {
        setSettings({ templatesEnabled: true }, { access: false });

        renderAdmin(true);

        expect(screen.queryByText('Access')).toBeNull();
        expect(screen.getByText('Templates')).toBeInTheDocument();
    });

    it('renders nothing when every link is hidden', () => {
        setSettings(
            { templatesEnabled: true },
            { templates: false, access: false }
        );

        const { container } = renderAdmin(true);

        expect(container).toBeEmptyDOMElement();
    });

    it('never shows Access to a non-admin', () => {
        setSettings({ templatesEnabled: true });

        renderAdmin(false);

        expect(screen.queryByText('Access')).toBeNull();
        expect(screen.getByText('Templates')).toBeInTheDocument();
    });
});
