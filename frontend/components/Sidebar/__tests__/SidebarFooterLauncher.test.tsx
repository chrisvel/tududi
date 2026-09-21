import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarFooter from '../SidebarFooter';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../contexts/TelegramStatusContext', () => ({
    useTelegramStatus: () => ({ status: 'none' }),
}));

const noop = jest.fn();

const renderFooter = async (setIsSidebarOpen = jest.fn()) => {
    render(
        <SidebarFooter
            currentUser={{ email: 'test@example.com' }}
            isDarkMode={false}
            toggleDarkMode={noop}
            isSidebarOpen
            setIsSidebarOpen={setIsSidebarOpen}
            isDropdownOpen={false}
            toggleDropdown={noop}
            openTaskModal={noop}
            openProjectModal={noop}
            onCreateNote={noop}
            openAreaModal={noop}
            openTagModal={noop}
        />
    );
    await screen.findByText('v1');
    return { setIsSidebarOpen };
};

describe('SidebarFooter all-entities launcher', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ version: 'v1' }),
        });
    });

    it('sits to the right of the create button and opens the modal', async () => {
        await renderFooter();
        const create = screen.getByLabelText('sidebar.createNew');
        const launcher = screen.getByTestId('app-launcher-button');

        expect(
            create.compareDocumentPosition(launcher) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(launcher);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('navigates with the title and closes the modal on selection', async () => {
        await renderFooter();
        fireEvent.click(screen.getByTestId('app-launcher-button'));

        fireEvent.click(screen.getByTestId('app-launcher-notes'));

        expect(mockNavigate).toHaveBeenCalledWith('/notes', {
            state: { title: 'Notes' },
        });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('collapses the sidebar on narrow screens after selection', async () => {
        const original = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            value: 500,
            configurable: true,
        });
        const { setIsSidebarOpen } = await renderFooter();

        fireEvent.click(screen.getByTestId('app-launcher-button'));
        fireEvent.click(screen.getByTestId('app-launcher-tags'));

        expect(setIsSidebarOpen).toHaveBeenCalledWith(false);
        Object.defineProperty(window, 'innerWidth', {
            value: original,
            configurable: true,
        });
    });
});
