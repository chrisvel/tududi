import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarTab from '../SidebarTab';
import {
    DEFAULT_LINK_ORDER,
    DEFAULT_SECTION_ORDER,
} from '../../../../utils/sidebarLayout';

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

const renderTab = (
    props: Partial<React.ComponentProps<typeof SidebarTab>> = {}
) => {
    const onToggleSection = jest.fn();
    const onReorder = jest.fn();
    const utils = render(
        <SidebarTab
            isActive
            visibleSections={{}}
            linkOrder={[...DEFAULT_LINK_ORDER]}
            sectionOrder={[...DEFAULT_SECTION_ORDER]}
            onToggleSection={onToggleSection}
            onReorder={onReorder}
            {...props}
        />
    );
    return { ...utils, onToggleSection, onReorder };
};

describe('SidebarTab', () => {
    it('renders nothing when the tab is not active', () => {
        const { container } = renderTab({ isActive: false });

        expect(container).toBeEmptyDOMElement();
    });

    it('shows a preview of the sidebar with its explanation', () => {
        renderTab();

        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar-preview')).toBeInTheDocument();
        expect(
            screen.getByText(/preview of your sidebar/i)
        ).toBeInTheDocument();
    });

    it('offers the Access row to admins only', () => {
        const { unmount } = renderTab();
        expect(screen.queryByText('Access')).toBeNull();
        unmount();

        renderTab({ isAdmin: true });
        expect(screen.getByText('Access')).toBeInTheDocument();
    });

    it('passes a switch click on as the item key', () => {
        const { onToggleSection } = renderTab({
            visibleSections: { projects: false },
        });

        fireEvent.click(screen.getByRole('switch', { name: 'Show Projects' }));

        expect(onToggleSection).toHaveBeenCalledWith('projects');
    });
});
