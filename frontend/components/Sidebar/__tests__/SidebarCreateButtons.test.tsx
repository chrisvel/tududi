import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarProjects from '../SidebarProjects';
import SidebarAreas from '../SidebarAreas';
import SidebarGoals from '../SidebarGoals';
import SidebarPeople from '../SidebarPeople';
import { useStore } from '../../../store/useStore';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const location = {
    pathname: '/today',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

const noop = jest.fn();

const cases = [
    {
        name: 'projects',
        label: 'Add Project',
        node: (
            <SidebarProjects
                handleNavClick={noop}
                location={location}
                isDarkMode={false}
                openProjectModal={noop}
            />
        ),
    },
    {
        name: 'areas',
        label: 'Add Area',
        node: (
            <SidebarAreas
                handleNavClick={noop}
                location={location}
                isDarkMode={false}
                openAreaModal={noop}
                areas={[]}
            />
        ),
    },
    {
        name: 'goals',
        label: 'Add Goal',
        node: <SidebarGoals handleNavClick={noop} location={location} />,
    },
    {
        name: 'people',
        label: 'Add Person',
        node: (
            <SidebarPeople
                handleNavClick={noop}
                location={location}
                openPersonModal={noop}
            />
        ),
    },
];

const setCapabilities = (
    capabilities: {
        create_people: boolean;
        invite_members: boolean;
        create_projects: boolean;
    } | null
) =>
    act(() => {
        useStore.getState().userSettingsStore.setCapabilities(capabilities);
    });

describe('sidebar create buttons', () => {
    beforeEach(() => {
        // The sidebars read lists that the app has already loaded.
        act(() => {
            useStore.setState((state: any) => ({
                projectsStore: {
                    ...state.projectsStore,
                    projects: [],
                    hasLoaded: true,
                },
                goalsStore: {
                    ...state.goalsStore,
                    goals: [],
                    hasLoaded: true,
                },
                peopleStore: {
                    ...state.peopleStore,
                    people: [],
                    hasLoaded: true,
                },
            }));
        });
        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ projects: [], areas: [], people: [] }),
        });
    });

    afterEach(() => setCapabilities(null));

    it.each(cases)(
        'shows $name create button for a user',
        ({ label, node }) => {
            setCapabilities({
                create_people: true,
                invite_members: false,
                create_projects: true,
            });

            render(node);

            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
    );

    it.each(cases)(
        'hides the $name create button for a guest',
        ({ label, node }) => {
            setCapabilities({
                create_people: false,
                invite_members: false,
                create_projects: false,
            });

            render(node);

            expect(screen.queryByLabelText(label)).toBeNull();
        }
    );

    it('keeps the projects button when only people were taken away', () => {
        setCapabilities({
            create_people: false,
            invite_members: false,
            create_projects: true,
        });

        render(cases[0].node);

        expect(screen.getByLabelText('Add Project')).toBeInTheDocument();
    });
});
