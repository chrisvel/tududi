import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarViews from '../SidebarViews';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('token'),
}));

const location = {
    pathname: '/today',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

const mockFetch = (sidebarSettings: unknown) => {
    global.fetch = jest.fn((url: string) => {
        const body = url.includes('views/pinned')
            ? [{ id: 1, uid: 'v1', name: 'My view', is_pinned: true }]
            : { sidebar_settings: sidebarSettings };
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(body),
        });
    }) as any;
};

describe('SidebarViews', () => {
    beforeEach(() => {
        localStorage.setItem('sidebarSectionExpanded:views', 'true');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders when saved sidebar settings have no pinned view order', async () => {
        mockFetch({ visibleSections: { views: true }, widthPercent: 20 });

        render(
            <SidebarViews
                handleNavClick={jest.fn()}
                location={location}
                isDarkMode={false}
            />
        );

        expect(await screen.findByText('My view')).toBeInTheDocument();
    });

    it('renders when sidebar settings are stored as a JSON string', async () => {
        mockFetch(JSON.stringify({ linkOrder: ['today'] }));

        render(
            <SidebarViews
                handleNavClick={jest.fn()}
                location={location}
                isDarkMode={false}
            />
        );

        expect(await screen.findByText('My view')).toBeInTheDocument();
    });
});
