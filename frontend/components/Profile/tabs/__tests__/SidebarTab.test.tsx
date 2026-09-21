import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarTab from '../SidebarTab';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            if (typeof fallback !== 'string') return key;
            return fallback.replace(
                /\{\{(\w+)\}\}/g,
                (_: string, name: string) => options?.[name] ?? ''
            );
        },
    }),
}));

const entityLabels = [
    'Favorites',
    'Projects',
    'Areas',
    'Goals',
    'Notes',
    'Tags',
    'People',
    'Habits',
    'Views',
    'Boards',
    'Insights',
    'Calendar',
    'Templates',
];

describe('SidebarTab', () => {
    it('renders nothing when the tab is not active', () => {
        const { container } = render(
            <SidebarTab
                isActive={false}
                visibleSections={{}}
                onToggleSection={jest.fn()}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('offers a toggle for every entity section and the existing links', () => {
        render(
            <SidebarTab
                isActive
                visibleSections={{}}
                onToggleSection={jest.fn()}
            />
        );

        for (const label of [
            ...entityLabels,
            'Upcoming',
            'Assigned to me',
            'Everyone',
        ]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        expect(
            screen.getByText('Show the Projects section in the sidebar.')
        ).toBeInTheDocument();
    });

    it('offers the Access toggle to admins only', () => {
        const { rerender } = render(
            <SidebarTab
                isActive
                visibleSections={{}}
                onToggleSection={jest.fn()}
            />
        );
        expect(screen.queryByText('Access')).toBeNull();

        rerender(
            <SidebarTab
                isActive
                isAdmin
                visibleSections={{}}
                onToggleSection={jest.fn()}
            />
        );
        expect(screen.getByText('Access')).toBeInTheDocument();
    });

    it('reports the section key when a toggle is clicked', () => {
        const onToggleSection = jest.fn();
        render(
            <SidebarTab
                isActive
                visibleSections={{ projects: false }}
                onToggleSection={onToggleSection}
            />
        );

        const row = screen.getByText('Projects').closest('div.flex');
        fireEvent.click(row!.querySelector('div.cursor-pointer')!);

        expect(onToggleSection).toHaveBeenCalledWith('projects');
    });
});
