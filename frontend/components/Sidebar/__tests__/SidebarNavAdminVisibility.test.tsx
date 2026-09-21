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
