import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxItemDetail from '../InboxItemDetail';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({ tagsStore: { tags: [] } }),
}));

jest.mock('../QuickCaptureInput', () => ({
    __esModule: true,
    default: function MockQuickCaptureInput() {
        return null;
    },
}));

const noop = () => {};

const renderItem = (item: any, onDelete = noop) =>
    render(
        <InboxItemDetail
            item={item}
            onDelete={onDelete}
            openTaskModal={noop}
            openProjectModal={noop}
            openNoteModal={noop}
            projects={[]}
        />
    );

describe('InboxItemDetail - blank content', () => {
    it('shows a placeholder for an item with empty content', () => {
        renderItem({ uid: 'abc123', content: '', title: null });

        expect(screen.getByText('(Empty item)')).toBeInTheDocument();
    });

    it('shows a placeholder for an item with whitespace-only content', () => {
        renderItem({ uid: 'abc123', content: '   \n  ', title: null });

        expect(screen.getByText('(Empty item)')).toBeInTheDocument();
    });

    it('allows deleting a blank item', () => {
        const onDelete = jest.fn();
        renderItem({ uid: 'abc123', content: '', title: null }, onDelete);

        fireEvent.click(screen.getByLabelText('Delete'));
        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

        expect(onDelete).toHaveBeenCalledWith('abc123');
    });

    it('renders the content for a non-blank item', () => {
        renderItem({ uid: 'abc123', content: 'Buy milk', title: null });

        expect(screen.queryByText('(Empty item)')).not.toBeInTheDocument();
        expect(screen.getByText('Buy milk')).toBeInTheDocument();
    });
});
