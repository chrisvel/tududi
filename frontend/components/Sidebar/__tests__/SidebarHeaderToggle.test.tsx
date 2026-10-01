import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarProjects from '../SidebarProjects';
import SidebarAreas from '../SidebarAreas';
import { useStore } from '../../../store/useStore';
import { Project } from '../../../entities/Project';
import { Area } from '../../../entities/Area';

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

// #1666: tapping anywhere on a section's header row opens or closes it, not
// only the small chevron. The title itself still opens the section's page.
describe('sidebar section header row', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('toggles the projects list from the header row', () => {
        act(() => {
            useStore.setState((state) => ({
                projectsStore: {
                    ...state.projectsStore,
                    projects: [
                        { uid: 'p1', name: 'Garden', status: 'planned' },
                    ] as Project[],
                    hasLoaded: true,
                },
            }));
        });
        const handleNavClick = jest.fn();
        render(
            <SidebarProjects
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={false}
                openProjectModal={jest.fn()}
            />
        );

        const row = screen.getByText('sidebar.projects').closest('li')!;
        expect(screen.queryByText('Garden')).not.toBeInTheDocument();

        fireEvent.click(row);
        expect(screen.getByText('Garden')).toBeInTheDocument();

        fireEvent.click(row);
        expect(screen.queryByText('Garden')).not.toBeInTheDocument();
        expect(handleNavClick).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('sidebar.projects'));
        expect(handleNavClick).toHaveBeenCalledWith(
            '/projects',
            'sidebar.projects',
            expect.anything()
        );
        expect(screen.getByText('Garden')).toBeInTheDocument();
    });

    it('toggles the areas list from the header row instead of navigating', () => {
        const handleNavClick = jest.fn();
        render(
            <SidebarAreas
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={false}
                openAreaModal={jest.fn()}
                areas={[{ uid: 'a1', name: 'Home' }] as Area[]}
            />
        );

        const row = screen.getByText('sidebar.areas').closest('li')!;
        fireEvent.click(row);
        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(handleNavClick).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('sidebar.areas'));
        expect(handleNavClick).toHaveBeenCalled();
    });
});
