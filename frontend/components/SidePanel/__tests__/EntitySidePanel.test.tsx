import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntitySidePanel from '../EntitySidePanel';
import { TaskStatusDropdown } from '../../Task/TaskPanelDropdowns';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

const withStatusMenu = {
    children: <TaskStatusDropdown value={0} onChange={jest.fn()} />,
};

const renderPanel = (
    overrides: Partial<React.ComponentProps<typeof EntitySidePanel>> = {}
) => {
    const props = {
        isOpen: true,
        onClose: jest.fn(),
        title: 'New thing',
        submitLabel: 'Create',
        onSubmit: jest.fn(),
        children: <input aria-label="Name" />,
        ...overrides,
    };
    render(<EntitySidePanel {...props} />);
    return props;
};

describe('EntitySidePanel', () => {
    it('renders nothing when closed', () => {
        renderPanel({ isOpen: false });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on Escape when nothing has changed', async () => {
        const props = renderPanel({ isDirty: false });
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('closes an open dropdown on Escape and stays open itself', async () => {
        const props = renderPanel(withStatusMenu);
        fireEvent.click(screen.getByTestId('task-status-select'));
        expect(document.querySelector('[data-portal-menu]')).not.toBeNull();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(document.querySelector('[data-portal-menu]')).toBeNull();
        expect(props.onClose).not.toHaveBeenCalled();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('closes an open dropdown on an outside click and stays open itself', async () => {
        const props = renderPanel(withStatusMenu);
        fireEvent.click(screen.getByTestId('task-status-select'));
        const scrim = document.querySelector(
            'div[aria-hidden="true"]'
        ) as HTMLElement;

        fireEvent.mouseDown(scrim);
        expect(document.querySelector('[data-portal-menu]')).toBeNull();
        expect(props.onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(scrim);
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('asks before discarding when the form is dirty', async () => {
        const props = renderPanel({ isDirty: true });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('discard-dialog-confirm'));
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('keeps editing when the discard prompt is cancelled', async () => {
        const props = renderPanel({ isDirty: true });
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.click(screen.getByTestId('discard-dialog-cancel'));
        expect(screen.queryByTestId('discard-dialog-confirm')).toBeNull();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('submits through the form and does not close', () => {
        const props = renderPanel();
        fireEvent.click(screen.getByTestId('side-panel-submit'));
        expect(props.onSubmit).toHaveBeenCalledTimes(1);
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('shows the delete action only when a handler is given', () => {
        const onDelete = jest.fn();
        renderPanel({ onDelete });
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});
