import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntitySidePanel from '../EntitySidePanel';

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
