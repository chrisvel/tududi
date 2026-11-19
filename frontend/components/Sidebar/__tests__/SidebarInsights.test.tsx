import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarInsights from '../SidebarInsights';

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

describe('SidebarInsights', () => {
    beforeEach(() => {
        localStorage.setItem('insightsSidebarCollapsed', 'false');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('links Daily Brief next to Productivity Assistant and Reports', () => {
        const handleNavClick = jest.fn();
        render(
            <SidebarInsights
                handleNavClick={handleNavClick}
                location={location}
            />
        );

        expect(screen.getByText('Productivity Assistant')).toBeInTheDocument();
        expect(screen.getByText('Reports')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Daily Brief'));

        expect(handleNavClick).toHaveBeenCalledWith(
            '/insights/daily-brief',
            'Daily Brief',
            expect.anything()
        );
    });
});
