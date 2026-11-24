import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { Squares2X2Icon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import BoardPinButton from '../components/Boards/BoardPinButton';
import SidebarBookmarks from '../components/Sidebar/SidebarBookmarks';
import { useStore } from '../store/useStore';
import { updateUiSettings } from '../utils/profileService';
import { boardPathKey, sanitizePinnedBoards } from '../utils/pinnedBoards';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, values?: any) =>
            (fallback ?? key).replace(
                /\{\{(\w+)\}\}/g,
                (_: string, name: string) => String(values?.[name] ?? '')
            ),
    }),
}));

jest.mock('../utils/profileService', () => ({
    updateUiSettings: jest.fn(),
}));

const saveMock = updateUiSettings as jest.Mock;
const pinned = () => useStore.getState().userSettingsStore.pinnedBoards;

const BOARD = {
    id: 'b1',
    name: 'Site sprint',
    path: '/boards/kanban?project=p1%2Cp2&tags=urgent',
};

const renderPin = (url: string, labels = ['Website', '#urgent']) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <BoardPinButton filterLabels={labels} />
        </MemoryRouter>
    );

describe('pinned boards', () => {
    beforeEach(() => {
        saveMock.mockReset().mockResolvedValue({ success: true });
        useStore.getState().userSettingsStore.setPinnedBoards([]);
    });

    it('keeps only well-formed boards pointing to a board page', () => {
        expect(
            sanitizePinnedBoards([
                BOARD,
                { ...BOARD, name: 'Duplicate id' },
                { id: 'b2', name: 'Elsewhere', path: '/projects' },
                { id: 'b3', name: 'Outside', path: 'https://example.com' },
                { id: 'b4', name: '  ', path: '/boards/kanban' },
                { id: 'b 5', name: 'Bad id', path: '/boards/kanban' },
                { id: 'b6', name: ' Matrix ', path: '/boards/eisenhower' },
                null,
            ])
        ).toEqual([
            BOARD,
            { id: 'b6', name: 'Matrix', path: '/boards/eisenhower' },
        ]);
        expect(sanitizePinnedBoards('nope')).toEqual([]);
    });

    it('treats a filter written with commas or %2C, in any order, as the same', () => {
        expect(boardPathKey('/boards/kanban?tags=urgent&project=p1,p2')).toBe(
            boardPathKey(BOARD.path)
        );
        expect(boardPathKey('/boards/kanban?project=p1')).not.toBe(
            boardPathKey(BOARD.path)
        );
    });

    it('pins the board with its filters under the name typed', async () => {
        renderPin('/boards/kanban?project=p1&tags=urgent');

        fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
        const input = screen.getByLabelText('Name in Favorites');
        expect(input).toHaveValue('Kanban Board · Website · #urgent');
        fireEvent.change(input, { target: { value: '  Urgent site  ' } });
        await act(async () => {
            fireEvent.submit(input.closest('form')!);
        });

        expect(pinned()).toEqual([
            {
                id: expect.any(String),
                name: 'Urgent site',
                path: '/boards/kanban?project=p1&tags=urgent',
            },
        ]);
        expect(saveMock).toHaveBeenCalledWith({ pinned_boards: pinned() });
        expect(
            screen.getByRole('button', { name: 'Pinned' })
        ).toBeInTheDocument();
    });

    it('shows the board as pinned whatever the filter encoding, and unpins it', async () => {
        useStore.getState().userSettingsStore.setPinnedBoards([BOARD]);
        renderPin('/boards/kanban?tags=urgent&project=p1,p2');

        const button = screen.getByRole('button', { name: 'Pinned' });
        expect(button).toHaveAttribute('title', 'Unpin "Site sprint"');
        await act(async () => {
            fireEvent.click(button);
        });

        expect(pinned()).toEqual([]);
        expect(saveMock).toHaveBeenCalledWith({ pinned_boards: [] });
        expect(screen.getByRole('button', { name: 'Pin' })).toBeInTheDocument();
    });

    it('puts the list back and says so when the save fails', async () => {
        saveMock.mockRejectedValue(new Error('offline'));
        renderPin('/boards/eisenhower?priority=high');

        fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
        expect(screen.getByLabelText('Name in Favorites')).toHaveValue(
            'Eisenhower Matrix · Website · #urgent'
        );
        await act(async () => {
            fireEvent.submit(
                screen.getByLabelText('Name in Favorites').closest('form')!
            );
        });

        expect(pinned()).toEqual([]);
        expect(
            screen.getByText('Could not pin the board.')
        ).toBeInTheDocument();
    });

    it('lists pinned boards under Favorites, marks the open one and unpins from there', async () => {
        useStore
            .getState()
            .userSettingsStore.setPinnedBoards([
                BOARD,
                { id: 'b2', name: 'Matrix', path: '/boards/eisenhower' },
            ]);
        const handleNavClick = jest.fn();
        localStorage.setItem('bookmarksSidebarCollapsed', 'false');
        render(
            <SidebarBookmarks
                handleNavClick={handleNavClick}
                location={
                    {
                        pathname: '/boards/kanban',
                        search: '?project=p1,p2&tags=urgent',
                    } as any
                }
            />
        );

        const item = screen.getByText('Site sprint').closest('div.group')!;
        expect(item.classList).toContain('bg-gray-100');
        expect(
            screen.getByText('Matrix').closest('div.group')!.classList
        ).not.toContain('bg-gray-100');

        // Same icons as the Boards section of the sidebar.
        const iconOf = (name: string) =>
            screen.getByText(name).parentElement!.querySelector('svg')!
                .innerHTML;
        const innerOf = (icon: React.ReactElement) =>
            renderToStaticMarkup(icon).replace(/^<svg[^>]*>|<\/svg>$/g, '');
        expect(iconOf('Site sprint')).toBe(innerOf(<ViewColumnsIcon />));
        expect(iconOf('Matrix')).toBe(innerOf(<Squares2X2Icon />));

        fireEvent.click(item);
        expect(handleNavClick).toHaveBeenCalledWith(
            BOARD.path,
            'Site sprint',
            expect.anything()
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Unpin Matrix' })
            );
        });
        expect(pinned()).toEqual([BOARD]);
        expect(saveMock).toHaveBeenCalledWith({ pinned_boards: [BOARD] });
    });
});
