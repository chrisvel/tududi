import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarNav from '../SidebarNav';
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

const location = {
    pathname: '/today',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

describe('Sidebar nav on phones', () => {
    beforeEach(() => {
        act(() => {
            useStore.setState((state: any) => ({
                userSettingsStore: {
                    ...state.userSettingsStore,
                    sidebarVisibleSections: {},
                },
            }));
        });
    });

    it('gives every row a 44px minimum height and larger text below md', () => {
        render(
            <SidebarNav
                handleNavClick={jest.fn()}
                location={location}
                isDarkMode={false}
                openTaskModal={jest.fn()}
            />
        );

        const rows = screen.getAllByTestId(/^sidebar-nav-/);
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach((row) => {
            expect(row).toHaveClass('max-md:min-h-[44px]');
            expect(row.querySelector('span.flex-1')).toHaveClass(
                'max-md:text-[16px]'
            );
        });
    });
});
