import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppLauncherModal from '../AppLauncherModal';
import { useStore } from '../../../store/useStore';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const setSettings = (settings: Record<string, boolean>) =>
    act(() => {
        useStore.setState((state: any) => ({
            userSettingsStore: { ...state.userSettingsStore, ...settings },
        }));
    });

const renderModal = (
    props: Partial<React.ComponentProps<typeof AppLauncherModal>> = {}
) => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    render(
        <AppLauncherModal
            isOpen
            onClose={onClose}
            onSelect={onSelect}
            {...props}
        />
    );
    return { onClose, onSelect };
};

describe('AppLauncherModal', () => {
    beforeEach(() => {
        setSettings({
            calendarEnabled: true,
            habitsEnabled: true,
            eisenhowerEnabled: true,
            kanbanEnabled: true,
            templatesEnabled: true,
            hasCollaborators: false,
        });
    });

    it('renders nothing when closed', () => {
        renderModal({ isOpen: false });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('lists the entities as a grid of tiles', () => {
        renderModal();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        for (const id of [
            'inbox',
            'projects',
            'areas',
            'goals',
            'notes',
            'tags',
            'people',
            'habits',
            'views',
        ]) {
            expect(
                screen.getByTestId(`app-launcher-${id}`)
            ).toBeInTheDocument();
        }
    });

    it('lists an entity whether or not it is shown in the sidebar', () => {
        act(() => {
            useStore.getState().userSettingsStore.setSidebarVisibleSections({
                projects: false,
                notes: false,
            });
        });

        renderModal();

        expect(screen.getByTestId('app-launcher-projects')).toBeInTheDocument();
        expect(screen.getByTestId('app-launcher-notes')).toBeInTheDocument();

        act(() => {
            useStore.getState().userSettingsStore.setSidebarVisibleSections({});
        });
    });

    it('leaves out features that are turned off', () => {
        setSettings({
            calendarEnabled: false,
            habitsEnabled: false,
            eisenhowerEnabled: false,
            kanbanEnabled: false,
            templatesEnabled: false,
            hasCollaborators: false,
        });

        renderModal();

        for (const id of [
            'calendar',
            'habits',
            'eisenhower',
            'kanban',
            'templates',
            'everyone',
        ]) {
            expect(screen.queryByTestId(`app-launcher-${id}`)).toBeNull();
        }
    });

    it('shows Everyone only when the account has collaborators', () => {
        setSettings({ hasCollaborators: true });

        renderModal();

        expect(screen.getByTestId('app-launcher-everyone')).toBeInTheDocument();
    });

    it('shows Access only to admins', () => {
        const { unmount } = render(
            <AppLauncherModal isOpen onClose={jest.fn()} onSelect={jest.fn()} />
        );
        expect(screen.queryByTestId('app-launcher-access')).toBeNull();
        unmount();

        render(
            <AppLauncherModal
                isOpen
                isAdmin
                onClose={jest.fn()}
                onSelect={jest.fn()}
            />
        );
        expect(screen.getByTestId('app-launcher-access')).toBeInTheDocument();
    });

    it('reports the chosen path and title', () => {
        const { onSelect } = renderModal();

        fireEvent.click(screen.getByTestId('app-launcher-projects'));

        expect(onSelect).toHaveBeenCalledWith('/projects', 'Projects');
    });

    it('closes on Escape, the close button and a backdrop click', () => {
        const { onClose } = renderModal();

        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.click(screen.getByLabelText('Close'));
        fireEvent.click(screen.getByTestId('app-launcher-backdrop'));

        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('does not close when the dialog itself is clicked', () => {
        const { onClose } = renderModal();

        fireEvent.click(screen.getByRole('dialog'));

        expect(onClose).not.toHaveBeenCalled();
    });
});
