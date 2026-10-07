import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarLayoutEditor from '../SidebarLayoutEditor';
import { useStore } from '../../../store/useStore';
import {
    DEFAULT_LINK_ORDER,
    DEFAULT_SECTION_ORDER,
} from '../../../utils/sidebarLayout';

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

let dropHandlers: Array<(event: any) => void> = [];

jest.mock('@dnd-kit/core', () => {
    const actual = jest.requireActual('@dnd-kit/core');
    return {
        ...actual,
        DndContext: ({ children, onDragEnd }: any) => {
            dropHandlers.push(onDragEnd);
            return <>{children}</>;
        },
    };
});

const setFeatures = (features: Record<string, boolean>) =>
    act(() => {
        useStore.setState((state: any) => ({
            userSettingsStore: { ...state.userSettingsStore, ...features },
        }));
    });

const renderEditor = (
    props: Partial<React.ComponentProps<typeof SidebarLayoutEditor>> = {}
) => {
    const onToggleSection = jest.fn();
    const onReorder = jest.fn();
    render(
        <SidebarLayoutEditor
            visibleSections={{}}
            linkOrder={[...DEFAULT_LINK_ORDER]}
            sectionOrder={[...DEFAULT_SECTION_ORDER]}
            isAdmin={false}
            onToggleSection={onToggleSection}
            onReorder={onReorder}
            {...props}
        />
    );
    return { onToggleSection, onReorder };
};

const renderedIds = () =>
    screen
        .getAllByTestId(/^sidebar-preview-row-/)
        .map((row) =>
            row.getAttribute('data-testid')!.replace('sidebar-preview-row-', '')
        );

describe('SidebarLayoutEditor', () => {
    beforeEach(() => {
        dropHandlers = [];
        setFeatures({
            calendarEnabled: true,
            habitsEnabled: true,
            templatesEnabled: true,
            eisenhowerEnabled: true,
            kanbanEnabled: true,
            hasCollaborators: true,
        });
    });

    it('previews the whole sidebar in its default order', () => {
        renderEditor();

        expect(renderedIds()).toEqual([
            ...DEFAULT_LINK_ORDER,
            ...DEFAULT_SECTION_ORDER,
            'templates',
        ]);
    });

    it('shows the links and sections in the saved order', () => {
        renderEditor({
            linkOrder: [
                'today',
                'inbox',
                'upcomingTasks',
                'calendar',
                'allTasks',
                'assignedToMe',
                'everyone',
            ],
            sectionOrder: [
                'notes',
                'projects',
                ...DEFAULT_SECTION_ORDER.filter(
                    (id) => id !== 'notes' && id !== 'projects'
                ),
            ],
        });

        const ids = renderedIds();
        expect(ids.slice(0, 2)).toEqual(['today', 'inbox']);
        expect(ids.slice(7, 9)).toEqual(['notes', 'projects']);
    });

    it('has a switch on every row that reflects what is visible', () => {
        renderEditor({ visibleSections: { projects: false, inbox: false } });

        expect(
            screen.getByRole('switch', { name: 'Show Projects' })
        ).toHaveAttribute('aria-checked', 'false');
        expect(
            screen.getByRole('switch', { name: 'Show Inbox' })
        ).toHaveAttribute('aria-checked', 'false');
        expect(
            screen.getByRole('switch', { name: 'Show Notes' })
        ).toHaveAttribute('aria-checked', 'true');
        expect(screen.getAllByRole('switch')).toHaveLength(19);
    });

    it('reports the item when a switch is clicked', () => {
        const { onToggleSection } = renderEditor();

        fireEvent.click(screen.getByRole('switch', { name: 'Show Goals' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show Templates' }));

        expect(onToggleSection).toHaveBeenNthCalledWith(1, 'goals');
        expect(onToggleSection).toHaveBeenNthCalledWith(2, 'templates');
    });

    it('offers a move handle on links and sections but not on the fixed bottom items', () => {
        renderEditor({ isAdmin: true });

        expect(
            screen.getByRole('button', { name: 'Move Inbox' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Move Projects' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Move Templates' })
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Move Access' })
        ).toBeNull();
    });

    it('shows Access only to admins', () => {
        const { unmount } = render(
            <SidebarLayoutEditor
                visibleSections={{}}
                linkOrder={[...DEFAULT_LINK_ORDER]}
                sectionOrder={[...DEFAULT_SECTION_ORDER]}
                isAdmin={false}
                onToggleSection={jest.fn()}
                onReorder={jest.fn()}
            />
        );
        expect(screen.queryByTestId('sidebar-preview-row-access')).toBeNull();
        unmount();

        renderEditor({ isAdmin: true });
        expect(
            screen.getByTestId('sidebar-preview-row-access')
        ).toBeInTheDocument();
    });

    it('marks rows whose feature is off', () => {
        setFeatures({
            calendarEnabled: false,
            habitsEnabled: false,
            templatesEnabled: false,
            eisenhowerEnabled: false,
            kanbanEnabled: false,
            hasCollaborators: false,
        });

        renderEditor();

        expect(screen.getAllByText('Off in Features')).toHaveLength(4);
        expect(screen.getByText('No collaborators')).toBeInTheDocument();
    });

    it('does not mark Boards when only one board is on', () => {
        setFeatures({ eisenhowerEnabled: false, kanbanEnabled: true });

        renderEditor();

        expect(screen.queryByText('Off in Features')).toBeNull();
    });

    it('does not draw divider lines between rows', () => {
        const { container } = render(
            <SidebarLayoutEditor
                visibleSections={{}}
                linkOrder={[...DEFAULT_LINK_ORDER]}
                sectionOrder={[...DEFAULT_SECTION_ORDER]}
                isAdmin
                onToggleSection={jest.fn()}
                onReorder={jest.fn()}
            />
        );

        expect(container.innerHTML).not.toMatch(/border-b|divide-y/);
    });

    describe('reordering', () => {
        it('reports the new order of the links after a drop', () => {
            const { onReorder } = renderEditor();

            act(() => {
                dropHandlers[0]({
                    active: { id: 'inbox' },
                    over: { id: 'upcomingTasks' },
                });
            });

            expect(onReorder).toHaveBeenCalledWith('links', [
                'today',
                'upcomingTasks',
                'inbox',
                'calendar',
                'allTasks',
                'assignedToMe',
                'everyone',
            ]);
        });

        it('reports the new order of the sections after a drop', () => {
            const { onReorder } = renderEditor();

            act(() => {
                dropHandlers[1]({
                    active: { id: 'insights' },
                    over: { id: 'favorites' },
                });
            });

            expect(onReorder).toHaveBeenCalledWith('sections', [
                'insights',
                'favorites',
                ...DEFAULT_SECTION_ORDER.filter(
                    (id) => id !== 'insights' && id !== 'favorites'
                ),
            ]);
        });

        it('ignores a drop on the same item or outside the list', () => {
            const { onReorder } = renderEditor();

            act(() => {
                dropHandlers[1]({
                    active: { id: 'notes' },
                    over: { id: 'notes' },
                });
                dropHandlers[1]({ active: { id: 'notes' }, over: null });
                dropHandlers[1]({
                    active: { id: 'notes' },
                    over: { id: 'nope' },
                });
            });

            expect(onReorder).not.toHaveBeenCalled();
        });
    });
});
